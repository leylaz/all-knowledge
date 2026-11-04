/* Section: Processes and threads
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "task"). */

section({
  id: "task",
  name: "Processes and Threads",
  cap: "fork, exec, exit and wait, signals, context switching, scheduling, preemption, spinlocks, futexes, seqlocks, RCU, deadlock, priority inversion",
  sections: [
    { id: "pages", label: "How the Pages Fit Together" }
  ],
  body: `
<p>A <strong>process</strong> is a running program plus everything the kernel tracks for it: an address space, open files, credentials, and one or more <strong>threads</strong>. Each thread has its own registers and stack, and threads of one process share everything else. These pages follow a process through its life and look at how the kernel shares cores among threads and keeps them from corrupting shared data.</p>
<p>All three depend on the kernel entry path in <a href="#/r/os">Kernel Entry</a>: creating a process is a system call, a switch usually starts with a timer interrupt or a blocking call, and a sleeping lock parks its waiters in the kernel.</p>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/process-syscalls">Process System Calls</a>: creating a process with <code>fork</code>, starting a program with <code>execve</code>, exiting and waiting, and signals.</li>
<li><a href="#/context-switch">Context Switching</a>: when the scheduler takes a core from one thread and gives it to another, and what that costs directly and in cold caches and TLBs.</li>
<li><a href="#/sync">Locks and Synchronization</a>: spinlocks, futexes, seqlocks, and RCU, plus the two ways locking goes wrong, deadlock and priority inversion.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A core time-slices four CPU-bound threads with a 3 ms slice (the EEVDF base slice on a machine with 8 or more cores). The switch itself takes 2 µs. Each thread touches a 1 MiB working set that the other three evict from the private L2 while it waits, and refilling a 64-byte line from the L3 takes 40 ns, with about 4 misses overlapping. What fraction of each slice is lost to switching?</p>`,
        a: `<ol><li><strong>Direct cost:</strong> 2 µs / 3 ms = <strong>0.07%</strong>.</li><li><strong>Lines to refill:</strong> 1 MiB / 64 B = 16,384 lines.</li><li><strong>Refill time:</strong> 16,384 × 40 ns / 4 = 163,840 ns ≈ 164 µs.</li><li><strong>Indirect cost:</strong> 164 µs / 3 ms ≈ <strong>5.5%</strong>.</li><li><strong>Total:</strong> about 5.5% of every slice, almost all of it from cold caches rather than from the switch itself. A shorter slice or a larger working set makes it worse, which is why schedulers resist very short slices for CPU-bound work.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A web server can handle each request in a freshly forked and exec'd process or hand it to a thread from a pool that lives as long as the server. At tens of thousands of requests per second, where does the per-process design lose time? Assume x86-64 Linux with PCID enabled.</p>`,
        a: `<ul><li><strong>fork:</strong> the kernel copies the page tables, marks every writable page copy-on-write in both processes, and flushes the parent's TLB entries for them. The first writes afterwards take copy-on-write faults.</li><li><strong>execve:</strong> the new address space is torn down and rebuilt, so the program's code, data, and libraries come back one page fault at a time, and the dynamic linker relocates the libraries again.</li><li><strong>Cold caches:</strong> each new process starts with cold caches, TLBs, and branch predictors, which costs far more than the system calls themselves.</li><li><strong>Switching:</strong> a switch between processes loads a new CR3. PCID keeps the old TLB entries tagged, but they are still useless to the new process. A switch between threads of one process keeps the address space, so its TLB entries stay useful.</li><li><strong>The pool:</strong> threads are created once and reuse a warm address space, so a request costs a queue handoff and perhaps a futex wake. The price is weaker isolation, since a crash or memory corruption in one request can take down the whole server.</li></ul>`
      }
    ]
  }
}, [
{
  id: "process-syscalls",
  region: "task",
  title: "Process System Calls",
  sections: [
    { id: "lifecycle", label: "The Life of a Process" },
    { id: "fork", label: "Creating a Process with fork" },
    { id: "spawn", label: "Starting a New Program: Exec and Spawn" },
    { id: "exit-wait", label: "Exiting and Waiting" },
    { id: "signals", label: "Signals" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p>A process is an address space, a descriptor table, and one or more threads, with an ID. A handful of calls create, change, and end processes. <code>fork</code> copies the calling process, <code>exec</code> replaces its program, <code>exit</code> ends it, and <code>wait</code> collects its result. Signals let the kernel and other processes interrupt it. Builds on <a href="#/demand-paging">Demand Paging and Copy-on-Write</a> and <a href="#/file-syscalls">File System Calls</a>. Main sources: Bryant and O’Hallaron’s <em>Computer Systems: A Programmer’s Perspective</em> (chapter 8), Arpaci-Dusseau’s <em>Operating Systems: Three Easy Pieces</em> (chapter 5, on the process API), and the Linux man pages.</p>

<h3 id="sec-lifecycle">The Life of a Process</h3>
<p>Every process except the first (<code>init</code>, PID 1) is created by another process, its parent. A shell running a command goes through the whole cycle:</p>
<ol>
<li><strong><code>fork</code>:</strong> the shell makes a copy of itself.</li>
<li><strong><code>exec</code>:</strong> the copy replaces its program with the command, keeping its PID and its open descriptors.</li>
<li><strong><code>exit</code>:</strong> the command finishes, and the kernel frees its memory and descriptors. The process becomes a <strong>zombie</strong> that keeps only its PID, exit status, and resource usage.</li>
<li><strong><code>wait</code>:</strong> the shell collects the exit status, and the kernel frees what was left of the zombie. This is called reaping.</li>
</ol>
<p>Other process calls worth knowing:</p>
<div class="tbl"><table>
<tr><th>Call</th><th>What it does</th></tr>
<tr><td><code>getpid</code>, <code>getppid</code></td><td>Return the caller's PID and its parent's PID</td></tr>
<tr><td><code>clone</code></td><td>Linux's general creation call. Its flags choose what the new task shares with its creator (address space, descriptor table, signal handlers), so it creates both processes and threads.</td></tr>
<tr><td><code>kill</code></td><td>Sends a signal to a process or a process group</td></tr>
<tr><td><code>sigaction</code></td><td>Installs a handler for a signal, or sets it to be ignored</td></tr>
<tr><td><code>nanosleep</code></td><td>Blocks the caller for a given time</td></tr>
<tr><td><code>sched_yield</code></td><td>Gives up the core to another runnable thread</td></tr>
</table></div>

<h3 id="sec-fork">Creating a Process with fork</h3>
<p><code>pid_t pid = fork()</code> is called once and returns twice: 0 in the child, and the child's PID in the parent (or −1 in the parent if it failed). The child starts as a copy of the parent at the moment of the call:</p>
<ul>
<li><strong>Copied:</strong> the address space (lazily, by <a href="#/demand-paging/cow">copy-on-write</a>), the registers, the descriptor table (pointing at the same open-file entries, see <a href="#/file-syscalls/sharing">Sharing Descriptors</a>), signal handlers, and the current directory.</li>
<li><strong>Not copied:</strong> the PID, pending signals, timers, record locks taken with <code>fcntl</code>, and every thread except the one that called <code>fork</code>.</li>
</ul>
<p>Which of the two runs first is up to the scheduler, so their output can interleave in any order. The missing threads are a trap for multithreaded programs. If another thread held a lock at the moment of the fork, the child's copy of that lock stays held forever by a thread that doesn't exist in the child. POSIX therefore allows only async-signal-safe functions in the child of a multithreaded program until it calls <code>exec</code>.</p>
<p>On Linux, <code>fork</code> is <code>clone</code> with no sharing flags. <code>pthread_create</code> is <code>clone</code> with flags such as <code>CLONE_VM</code>, <code>CLONE_FILES</code>, <code>CLONE_SIGHAND</code>, and <code>CLONE_THREAD</code>, so the new thread shares the address space and page table, and there is nothing to copy or write-protect.</p>

<h3 id="sec-spawn">Starting a New Program: Exec and Spawn</h3>
<p><code>execve(path, argv, envp)</code> replaces the calling process's program and doesn't return if it succeeds:</p>
<ul>
<li><strong>Replaced:</strong> the whole address space. The kernel discards every region and builds new ones for the executable's segments and its dynamic loader (see <a href="#/comp-load">Loading and Running</a>), plus a new stack holding <code>argv</code>, <code>envp</code>, and the auxiliary vector.</li>
<li><strong>Reset:</strong> caught signals go back to their default action, since the handler code no longer exists. Ignored signals stay ignored.</li>
<li><strong>Kept:</strong> the PID, the parent, descriptors not marked close-on-exec, the current directory, and resource limits.</li>
</ul>
<p>What starting a program costs, and how to avoid paying for a fork first:</p>
<ul>
<li><strong>Memory use</strong> starts near zero: the new regions point at the executable's file offsets, all not present. No memory is used until the program starts touching its pages, and the page cache and readahead usually have the hot pages ready before they are needed.</li>
<li><strong><code>fork</code> then <code>exec</code></strong> still pays for the fork: copying the page table and write-protecting every writable page of the parent, even though the child is about to discard all of it. For a parent with tens of gigabytes mapped, that is tens of megabytes of page-table entries to copy, then a write fault on the first store to each page.</li>
<li><strong><code>posix_spawn</code></strong> avoids the copy. glibc implements it with <code>clone(CLONE_VM | CLONE_VFORK)</code>: the child runs on the parent's own page table, with no copy and no write-protection, while the parent waits. The child does only a fixed list of safe steps (the file actions, such as redirecting descriptors), then calls <code>exec</code>, at which point the parent resumes. Because those steps are known not to disturb the parent's memory, sharing the address space for that short window is safe.</li>
</ul>

<h3 id="sec-exit-wait">Exiting and Waiting</h3>
<ul>
<li><strong><code>exit(status)</code></strong> is a library function. It runs <code>atexit</code> handlers and flushes <code>FILE</code> buffers, then calls <code>_exit</code>. Returning from <code>main</code> does the same.</li>
<li><strong><code>_exit(status)</code></strong> is the system call (<code>exit_group</code> on Linux, which ends every thread of the process). The kernel closes all descriptors, releases the address space, hands any children to <code>init</code> (or to a designated subreaper), keeps the low 8 bits of the status, and sends <code>SIGCHLD</code> to the parent.</li>
<li><strong><code>waitpid(pid, &amp;status, options)</code></strong> blocks until a child changes state, returns its PID, and reaps it. <code>WIFEXITED</code> and <code>WEXITSTATUS</code> decode a normal exit, and <code>WIFSIGNALED</code> and <code>WTERMSIG</code> decode a death by signal. With <code>WNOHANG</code>, it returns 0 at once instead of blocking if no child has finished.</li>
</ul>
<p>Until it is reaped, a finished child stays a zombie. It holds a PID and its kernel task structure, a few KiB, but no memory or files. A parent that never waits leaks PIDs. If the parent dies first, <code>init</code> adopts the orphan and reaps it.</p>

<h3 id="sec-signals">Signals</h3>
<p>A signal is a small message, just a number, that the kernel delivers to a process. Some start as a hardware exception, and the rest come from other processes or the kernel:</p>
<div class="tbl"><table>
<tr><th>Signal</th><th>Default action</th><th>Typical cause</th></tr>
<tr><td><code>SIGSEGV</code></td><td>Terminate and dump core</td><td>A page fault the kernel can't fix: the address is in no region, or the access breaks the region's permissions</td></tr>
<tr><td><code>SIGFPE</code></td><td>Terminate and dump core</td><td>An integer divide by zero</td></tr>
<tr><td><code>SIGILL</code></td><td>Terminate and dump core</td><td>An illegal instruction</td></tr>
<tr><td><code>SIGBUS</code></td><td>Terminate and dump core</td><td>A touch of a mapped file page past the end of the file</td></tr>
<tr><td><code>SIGINT</code></td><td>Terminate</td><td>Ctrl-C in the terminal</td></tr>
<tr><td><code>SIGTERM</code></td><td>Terminate</td><td>A polite request to exit, and the default for the <code>kill</code> command</td></tr>
<tr><td><code>SIGKILL</code></td><td>Terminate, and can't be caught or ignored</td><td><code>kill -9</code>, or the kernel's out-of-memory killer</td></tr>
<tr><td><code>SIGCHLD</code></td><td>Ignore</td><td>A child exited or stopped</td></tr>
</table></div>
<p>Delivery reuses the kernel-entry machinery from <a href="#/exceptions/trap-frame">The Handler and the Trap Frame</a>:</p>
<ol>
<li><code>kill(pid, sig)</code>, or the kernel itself, sets the signal's bit in the target's pending set. If the target is asleep in a system call that can be interrupted, the kernel wakes it.</li>
<li>Signals are acted on only on the way back to user mode. On every return from a system call, interrupt, or exception, the kernel checks for signals that are pending and not blocked.</li>
<li>For a caught signal, the kernel pushes a <strong>signal frame</strong> holding the saved user registers onto the user stack. Then it edits the trap frame so that the return lands at the start of the handler, with the signal number as its argument and a return address pointing at a short trampoline (provided by libc on x86-64 Linux).</li>
<li>The handler runs in user mode. When it returns, the trampoline calls <code>rt_sigreturn</code>, which restores the registers from the signal frame, and the program continues where it was interrupted.</li>
</ol>
<p>A signal that arrives while the process is blocked in a slow call, such as <code>read</code> on a pipe or terminal, makes the call fail with <code>EINTR</code> if no data has been transferred yet. If the handler was installed with <code>SA_RESTART</code>, the kernel restarts the call instead. Pending signals form a set, not a queue: two <code>SIGCHLD</code>s that arrive before the handler runs look like one.</p>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong><code>fork</code> scales with the parent's page table, not its work.</strong> Copying and write-protecting entries costs time per mapped page, and copy-on-write faults follow (see <a href="#/demand-paging/perf">Demand Paging and Copy-on-Write</a>). A threaded parent also pays TLB shootdowns.</li>
<li><strong>Threads are cheaper than processes</strong> to create and to switch between. A switch between threads of one process keeps the page table and the TLB's contents. A switch between processes loads a new page-table base, and ASID or PCID tags only avoid a full TLB flush, not the misses on the new process's pages.</li>
<li><strong><code>exec</code> costs mostly faults.</strong> The call itself is short, but the new program then faults in every page it touches, and dynamic linking loads and relocates shared libraries before <code>main</code> runs.</li>
<li><strong>Signals are slow</strong> compared with function calls: each delivery is a kernel entry, a frame built on the user stack, and a second system call to return, on the order of microseconds. Programs that handle frequent events (timers, I/O readiness) read them from a descriptor with <code>signalfd</code>, <code>timerfd</code>, or <code>epoll</code> instead.</li>
<li><strong>For a simulator:</strong> syscall-emulation modes such as gem5 SE carry out <code>fork</code>, <code>exec</code>, and signals inside the simulator, often only in part, so their kernel cost doesn't appear. Process-heavy workloads such as shells, build systems, and pre-fork servers need full-system simulation.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>What does this program print when standard output is a terminal, and when it is redirected to a file?</p><pre><code>int main(void) {
    printf("A\\n");
    for (int i = 0; i &lt; 2; i++)
        fork();
    printf("B\\n");
    return 0;
}</code></pre>`,
        a: `<ol><li>Count processes: the first iteration's <code>fork</code> makes 2 processes, and both run the second iteration, making 4.</li><li>Each of the 4 processes prints "B", so there are 4 B lines in both cases.</li><li>Terminal: <code>stdout</code> is line-buffered, so "A\\n" is written to the terminal before the first fork, and no copy of it is left in any buffer. Output: one A, then four Bs, <strong>5 lines</strong>.</li><li>File: <code>stdout</code> is fully buffered (4 KiB), so "A\\n" is still in the buffer at the first fork, and each fork copies the buffer along with the rest of the address space. All 4 processes hold "A\\n", add "B\\n", and flush at exit. Output: A, B repeated four times, <strong>8 lines</strong>.</li><li>Fix: call <code>fflush(stdout)</code> before <code>fork</code>.</li></ol>`
      },
      {
        q: `<p>On x86-64 Linux, a program installs a <code>SIGINT</code> handler with <code>sigaction</code> (without <code>SA_RESTART</code>) that only sets a flag, then calls <code>read</code> on the terminal, and no input has been typed yet. The user presses Ctrl-C. Trace the events until the code after <code>read</code> runs, and say what <code>read</code> returns.</p>`,
        a: `<ol><li>The keyboard input arrives through an interrupt. The terminal driver sees the Ctrl-C character and sends <code>SIGINT</code> to the terminal's foreground process group, which sets the pending bit in the program and wakes it from its sleep inside <code>read</code>.</li><li>The <code>read</code> code in the kernel finds a signal pending and no data transferred, so it stops and prepares to return an interrupted-call error.</li><li>On the way back to user mode, the kernel finds <code>SIGINT</code> pending and caught. Because there is no <code>SA_RESTART</code>, it sets the saved rax to −EINTR. It pushes a signal frame with the saved registers onto the user stack and edits the trap frame so the return goes to the handler, with rdi = 2 (<code>SIGINT</code>).</li><li>The handler sets the flag and returns into the trampoline, which calls <code>rt_sigreturn</code>. The kernel restores the registers from the signal frame, including rax = −EINTR, and returns to the instruction after <code>syscall</code> in libc's <code>read</code> wrapper.</li><li>The wrapper sees −EINTR, sets <code>errno = EINTR</code>, and returns <strong>−1</strong>. The program can then check the flag. With <code>SA_RESTART</code>, the kernel would instead rewind the saved PC to the <code>syscall</code> instruction, and <code>read</code> would block again.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 16-thread server calls <code>fork</code>, and before <code>execve</code> the child calls a logging library that takes the library's mutex. Occasionally the child hangs forever. Why, and what are two fixes?</p>`,
        a: `<p>Only the thread that called <code>fork</code> exists in the child. If one of the other 15 threads held the logging mutex at that moment, the child inherits a copy of the mutex in its locked state, and no thread in the child will ever unlock it, so the child's first lock attempt waits forever. It is intermittent because it needs the fork to land while the lock is held. glibc protects its own <code>malloc</code> and <code>stdio</code> locks with internal fork handlers, but other libraries' locks get no such care, which is why POSIX allows only async-signal-safe calls in the child of a multithreaded program until <code>exec</code>. Fixes:</p><ul><li>Do nothing in the child but async-signal-safe setup (<code>dup2</code>, <code>close</code>) and <code>execve</code>, or use <code>posix_spawn</code>, which does exactly that.</li><li>Register <code>pthread_atfork</code> handlers that take the mutex before the fork and release it in both processes after.</li><li>Fork all helpers from a small single-threaded process started before any threads exist.</li></ul>`
      },
      {
        q: `<p>A server forks a child per connection, and each child handles one request and exits. The server never calls <code>wait</code>. After a few days, <code>fork</code> starts failing with <code>EAGAIN</code>. What accumulated, what was freed, and how do you fix it without blocking the accept loop?</p>`,
        a: `<p>Every child became a zombie. Its memory, descriptors, and address space were freed at exit, but its PID and task structure stay until the parent reaps it. Eventually the zombies use up the PID space (<code>pid_max</code>) or the user's process limit, and <code>fork</code> fails. Fixes:</p><ul><li>Install a <code>SIGCHLD</code> handler that calls <code>waitpid(-1, &amp;status, WNOHANG)</code> in a loop until it returns 0 or −1. The loop is required because pending signals don't queue: if several children exit before the handler runs, the handler is called once.</li><li>Set <code>SIGCHLD</code> to <code>SIG_IGN</code>, which tells the kernel to reap children automatically (the server then can't read their exit status).</li><li>Reap from the event loop with a <code>WNOHANG</code> loop, or with <code>signalfd</code> or a pidfd, if the server already uses <code>epoll</code>.</li></ul>`
      },
      {
        q: `<p>A pre-fork web server's master process has 6 GiB of resident anonymous memory in 4 KiB pages, with 8-byte page-table entries. It forks 64 workers. Each fork copies and write-protects the leaf entries at 1.5 ns per entry. Over its life, each worker writes to 12.5% of the inherited pages, and each copy-on-write fault costs 1.2 µs including the copy. Assume no two workers' copies are shared and no huge pages. How long do the forks take, how much memory and fault time do the workers add, and how does total memory compare with 64 independent processes that each load the same 6 GiB?</p>`,
        a: `<ol><li>Pages = 6 GiB / 4 KiB = 1,572,864. Leaf entries copied per fork = 1,572,864 × 8 B = 12 MiB.</li><li>Fork time = 1,572,864 × 1.5 ns = 2.36 ms per fork, and 64 × 2.36 ms = <strong>151 ms</strong> for all workers.</li><li>Pages written per worker = 0.125 × 1,572,864 = 196,608, so each worker adds 196,608 × 4 KiB = 768 MiB. All 64 add 64 × 768 MiB = <strong>48 GiB</strong>.</li><li>Fault time per worker = 196,608 × 1.2 µs = 0.236 s, and 64 × 0.236 s = <strong>15.1 s</strong> of CPU time.</li><li>Total with copy-on-write = 6 GiB + 48 GiB = <strong>54 GiB</strong>. Independent processes need 64 × 6 GiB = <strong>384 GiB</strong>, about 7× more.</li><li>The write fraction drives everything. In CPython, reference counting and the garbage collector write to objects that are only read, which pushes the fraction up. That is why Instagram froze the collector's heap before forking, which led to <code>gc.freeze()</code> in Python 3.7.</li></ol>`
      },
      {
        q: `<p>On Linux, both <code>fork</code> and <code>pthread_create</code> are built on <code>clone</code>. Why is creating a thread so much cheaper than creating a process, and why is switching between two threads of one process cheaper than switching between two processes?</p>`,
        a: `<ul><li><strong>Creation:</strong> <code>pthread_create</code> passes <code>CLONE_VM</code> and related flags, so the new thread shares the creator's memory descriptor and page table. There are no page-table entries to copy, nothing to write-protect, no TLB shootdown, and no copy-on-write faults afterward. <code>fork</code> does all of these, with cost proportional to the parent's mapped memory. A thread still needs a kernel task structure, a kernel stack, and a user stack, which <code>mmap</code> reserves.</li><li><strong>Switching:</strong> both kinds of switch save and restore registers and run the scheduler. Between threads of one process, the page-table base stays the same, so every TLB entry stays valid, and the caches stay warm with shared data. Between processes, the kernel loads a new page-table base. PCID or ASID tags keep the old entries from being flushed, but the new process still misses on its own pages, and its working set must displace the old one in the caches.</li></ul>`
      }
    ]
  }
},

{
  id: "context-switch",
  region: "task",
  title: "Context Switching",
  sections: [
    { id: "what-switch", label: "What a Context Switch Is" },
    { id: "triggers", label: "What Triggers a Switch" },
    { id: "preemption", label: "Preemption Points" },
    { id: "scheduler", label: "How the Scheduler Decides" },
    { id: "switch-path", label: "The Switch Itself" },
    { id: "cost", label: "Direct and Indirect Costs" },
    { id: "measure", label: "Measuring and Modeling" }
  ],
  body: `
<h3 id="sec-what-switch">What a Context Switch Is</h3>
<p>A <strong>context switch</strong> moves a core from running one thread to running another. It is different from a mode switch: a system call or an interrupt enters the kernel and usually returns to the same thread (see <a href="#/exceptions">Faults, Traps, Interrupts, and System Calls</a>). A context switch happens only when the kernel, already running on behalf of one thread, decides to return to a different one.</p>
<p>The state that has to change hands:</p>
<ul>
<li><strong>User registers, PC, and flags.</strong> These were already saved in the thread's <a href="#/exceptions/trap-frame">trap frame</a> on its kernel stack when it entered the kernel, so the switch doesn't copy them again.</li>
<li><strong>The kernel's own context:</strong> the callee-saved registers and the kernel stack pointer at the point where the thread called the scheduler. Linux keeps them in the thread's <code>task_struct</code>.</li>
<li><strong>Floating-point and vector state.</strong> With AVX-512 the XSAVE area is about 2.7 KB, and AMX tiles add 8 KB more.</li>
<li><strong>The address space</strong> (CR3 on x86, <code>satp</code> on RISC-V, TTBR0 on Arm), but only if the next thread belongs to a different process.</li>
<li><strong>Per-thread registers</strong> such as the thread-local storage base (FS base on x86-64) and debug registers.</li>
</ul>
<p>A <strong>thread switch</strong> within one process keeps the address space, so it skips the page-table switch and leaves the TLB and the process's cached data useful. A <strong>process switch</strong> changes the address space as well.</p>

<h3 id="sec-triggers">What Triggers a Switch</h3>
<p>Every switch starts with the kernel running, either because the thread called into it or because an interrupt took the core there. The triggers fall into two groups, which Linux counts separately per thread:</p>
<div class="tbl"><table>
<tr><th>Trigger</th><th>Kind</th><th>Example</th></tr>
<tr><td>Blocking</td><td>Voluntary</td><td>A <code>read</code> on an empty socket, a <code>futex</code> wait on a held lock, a major page fault waiting for the disk, <code>nanosleep</code></td></tr>
<tr><td>Yielding</td><td>Voluntary</td><td><code>sched_yield</code>, or a spin-then-sleep lock giving up</td></tr>
<tr><td>Exit</td><td>Voluntary</td><td>The thread calls <code>exit</code></td></tr>
<tr><td>Time slice used up</td><td>Involuntary</td><td>The timer interrupt finds that the running thread has had its share</td></tr>
<tr><td>Wakeup preemption</td><td>Involuntary</td><td>A thread that was blocked becomes runnable and deserves the core more than the one running</td></tr>
<tr><td>Priority or policy change</td><td>Involuntary</td><td>A real-time thread becomes runnable, or a thread's priority is raised</td></tr>
<tr><td>Migration</td><td>Involuntary</td><td>Load balancing moves a thread to this core, or <code>sched_setaffinity</code> moves the running one away</td></tr>
</table></div>
<p>The timer is what makes involuntary switches possible at all. Without it, a thread in an infinite loop that never makes a system call would keep the core forever. Linux programs the local APIC timer to fire <code>CONFIG_HZ</code> times per second (typically 250 or 1,000), and the tick handler charges the running thread for the time it used and checks whether it should yield. An idle core stops its tick, and a core with a single runnable thread can stop it too (<code>nohz_full</code>), which matters to latency-sensitive and HPC workloads.</p>
<p>A wakeup on another core arrives as a <strong>reschedule IPI</strong>: when the thread a core wakes should run on a different core, it sends that core an inter-processor interrupt so it re-evaluates its choice right away instead of at its next tick.</p>

<h3 id="sec-preemption">Preemption Points</h3>
<p>The decision to switch and the switch itself happen at different times. When the tick or a wakeup decides the running thread should give up the core, the kernel only sets a flag on it (<code>TIF_NEED_RESCHED</code> on Linux). The thread is switched out at the next <strong>preemption point</strong>, where the kernel checks the flag and calls the scheduler:</p>
<ul>
<li><strong>Return to user mode</strong>, after any system call or interrupt. This is the common case, and it is always safe, because the thread holds no kernel locks there.</li>
<li><strong>Return from an interrupt to kernel code</strong>, if the kernel is built preemptible and the interrupted code holds no spinlocks (a per-thread preemption count tracks that).</li>
<li><strong>Explicit checks</strong> (<code>cond_resched</code>) that long-running kernel loops call.</li>
</ul>
<p>Linux offers several preemption models that trade throughput for latency: none (switch only on return to user or on blocking), voluntary (also at explicit checks), full (also on return from interrupts into the kernel), lazy (6.13 onward: full preemption for real-time threads, but fair-class threads are preempted in the kernel only at the next tick), and real-time (<code>PREEMPT_RT</code>, merged in 6.12, which makes even most spinlock sections preemptible).</p>

<h3 id="sec-scheduler">How the Scheduler Decides</h3>
<p>Each core has its own run queue, and the scheduler picks the next thread from it. Linux tries its scheduling classes in strict priority order, and a thread in a higher class always runs before any thread in a lower one:</p>
<ol>
<li><strong>Deadline</strong> (<code>SCHED_DEADLINE</code>): each thread declares a runtime, deadline, and period, and the scheduler runs the one with the earliest deadline.</li>
<li><strong>Real-time</strong> (<code>SCHED_FIFO</code>, <code>SCHED_RR</code>), priorities 1&ndash;99: the highest-priority runnable thread runs. A FIFO thread runs until it blocks or yields, and a round-robin thread rotates with equal-priority peers every 100 ms.</li>
<li><strong>Fair</strong> (<code>SCHED_NORMAL</code>, <code>SCHED_BATCH</code>): almost every thread, sharing the core in proportion to weights set by the nice value.</li>
<li><strong>Idle</strong> (<code>SCHED_IDLE</code>): runs only when nothing else wants the core.</li>
</ol>
<p><strong>The fair class.</strong> Each nice value maps to a weight: 1,024 at nice 0, about 1.25&times; more per step down and 1.25&times; less per step up (nice 5 is 335, nice &minus;5 is 3,121). The scheduler gives each runnable thread a share of the core proportional to its weight. To track that, it keeps each thread's <strong>virtual runtime</strong>: real running time scaled by 1,024 / weight, so a heavy thread's virtual clock runs slowly. The completely fair scheduler (CFS, Linux 2.6.23 to 6.5) always ran the thread with the smallest virtual runtime, kept in a red-black tree, and let it run for a slice of a target latency (6 ms by default, scaled up on machines with more cores) divided among the runnable threads.</p>
<p>Since Linux 6.6 the fair class uses <strong>EEVDF</strong> (earliest eligible virtual deadline first, Stoica and Abdel-Wahab, 1995). It keeps the same weights and virtual time, but picks threads in two steps:</p>
<ul>
<li><strong>Eligibility:</strong> a thread is eligible if it has received no more than its fair share so far (its lag, fair service minus actual service, is at least 0).</li>
<li><strong>Deadline:</strong> each thread asks for a slice (3 ms by default on a machine with 8 or more CPUs), and its virtual deadline is its eligible time plus slice &times; 1,024 / weight. Among eligible threads, the one with the earliest virtual deadline runs.</li>
</ul>
<p>Fairness over time comes from the weights, and latency comes from the slice: a thread that asks for a shorter slice (through <code>sched_setattr</code>, since 6.12) gets an earlier deadline and runs sooner after it wakes, without getting a larger share. A waking thread preempts the running one if it is eligible and its deadline is earlier.</p>
<p><strong>Across cores</strong>, the scheduler balances load periodically and whenever a core goes idle, walking a hierarchy of scheduling domains (SMT siblings, then cores sharing a last-level cache, then NUMA nodes). Moving a thread costs its cache warmth, so the balancer prefers nearby cores and treats a thread that ran within the last 0.5 ms as cache-hot and not worth moving.</p>
<details class="ex"><summary>Worked example: how weights divide a core</summary>
<p><strong>Question.</strong> Two CPU-bound threads share one core under the fair class: thread A at nice 0 (weight 1,024) and thread B at nice 5 (weight 335). Neither ever blocks. Find:</p>
<ol>
<li>Each thread's share of the core.</li>
<li>How much each thread's virtual runtime grows over 1 second.</li>
<li>The shares after a third CPU-bound thread C at nice &minus;5 (weight 3,121) joins.</li>
</ol>
<p><strong>Solution.</strong></p>
<ol>
<li><strong>Shares:</strong> total weight 1,024 + 335 = 1,359. A gets 1,024 / 1,359 = <strong>75.3%</strong>, B gets 335 / 1,359 = <strong>24.7%</strong>.</li>
<li><strong>Virtual runtime:</strong> A runs 753 ms and its virtual runtime grows by 753 &times; 1,024 / 1,024 = 753 ms. B runs 247 ms and grows by 247 &times; 1,024 / 335 = 755 ms. They grow at the same rate (up to rounding), which is exactly what the scheduler enforces.</li>
<li><strong>With C:</strong> total weight 4,480. C gets 3,121 / 4,480 = <strong>69.7%</strong>, A gets 1,024 / 4,480 = <strong>22.9%</strong>, and B gets 335 / 4,480 = <strong>7.5%</strong>.</li>
</ol>
</details>

<h3 id="sec-switch-path">The Switch Itself</h3>
<p>On Linux x86-64, the scheduler's <code>__schedule</code> picks the next thread and calls <code>context_switch</code>, which does three things:</p>
<ol>
<li><strong>Switch the address space</strong> (<code>switch_mm_irqs_off</code>). If the next thread is in another process, it writes that process's page-table root into CR3 with its PCID, so the TLB keeps both processes' entries instead of flushing (see <a href="#/demand-paging/root-table">Setting Up CR3 and the Root Table</a>). Threads of the same process skip this step. Kernel threads have no user address space and borrow the previous one ("lazy TLB" mode), so switching to them and back costs no CR3 write either.</li>
<li><strong>Switch stacks</strong> (<code>switch_to</code>). It pushes the callee-saved registers on the old thread's kernel stack, saves the stack pointer in its <code>task_struct</code>, loads the new thread's stack pointer, and pops its callee-saved registers. From this instruction on, the core is running the new thread, still inside the scheduler, where that thread last called it.</li>
<li><strong>Switch the rest</strong> (<code>__switch_to</code>): the FS and GS bases, the per-CPU top-of-stack variable that the entry code reads to find the new thread's kernel stack on the next kernel entry, and the FPU state. The CPU itself still lands on the per-CPU entry stack from RSP0, which doesn't change between threads. Linux saves the old thread's vector registers with <code>XSAVES</code>, which skips components still in their initial state, and restores the new thread's lazily, on its next return to user mode, so a kernel thread or a thread that blocks again before returning never pays for it.</li>
</ol>
<p>The new thread then returns out of the scheduler along its own call chain, and eventually to user mode through its own trap frame. That is the sense in which a context switch "returns through a different thread's trap frame."</p>

<h3 id="sec-cost">Direct and Indirect Costs</h3>
<p><strong>The direct cost</strong> is the kernel's work: the trap in, the scheduler's decision, the register and stack switch, a CR3 write for a process switch, and the trap out. Ping-ponging a token between two processes on one core through a pipe measures it at a microsecond or two per switch on recent cores, including the system calls around it. Security mitigations add to it: an indirect-branch predictor barrier (IBPB) on a switch between processes costs thousands of cycles on many cores, so Linux by default issues one only for processes that ask for it.</p>
<p><strong>The indirect cost</strong> is usually larger. While the other thread ran, it replaced the first thread's lines in the caches, its TLB entries, and its branch-predictor state. PCIDs keep the TLB from being flushed, but they can't stop the other process's entries from evicting its entries. When the first thread resumes, it runs slowly until it has refilled them. Li, Ding, and Shen measured direct costs of a few microseconds and indirect costs that grew with the working set, past a millisecond for large ones.</p>
<details class="ex"><summary>Worked example: refilling the cache after a switch</summary>
<p><strong>Question.</strong> Two processes alternate on one 3.0 GHz core, each running for 3 ms before the other one gets the core. Assume:</p>
<ul>
<li>Process A's working set is 1 MB and fits in the core's private 2 MB L2 cache, with 64-byte lines.</li>
<li>While B runs, it evicts 60% of A's lines from the L2.</li>
<li>Each evicted line costs A a miss to the L3 of 80 cycles, and A overlaps 4 misses at a time, so each miss effectively costs 20 cycles.</li>
<li>The direct cost of a switch is 2 µs.</li>
</ul>
<p>Find the indirect cost per switch, compare it with the direct cost, and find the total fraction of A's time lost.</p>
<p><strong>Solution.</strong></p>
<ol>
<li><strong>Lines refilled:</strong> 1 MB / 64 B = 16,384 lines, and 60% of them is about 9,830.</li>
<li><strong>Indirect cost:</strong> 9,830 &times; 20 = 196,600 cycles, or 196,600 / 3.0 GHz &asymp; <strong>65.5 µs</strong>, about 33 times the 2 µs direct cost.</li>
<li><strong>Overhead:</strong> (65.5 + 2) / 3,000 µs &asymp; <strong>2.25%</strong> of each 3 ms slice.</li>
</ol>
<p>The switch itself is cheap. What costs time is the working set B destroyed, which is why the balancer keeps cache-hot threads where they are, and why latency-sensitive services pin threads to cores instead of sharing them.</p>
</details>

<h3 id="sec-measure">Measuring and Modeling</h3>
<ul>
<li><strong>Counting switches:</strong> <code>/proc/&lt;pid&gt;/status</code> reports <code>voluntary_ctxt_switches</code> and <code>nonvoluntary_ctxt_switches</code> per thread. <code>perf stat -e context-switches,cpu-migrations</code> counts them over a run, and <code>vmstat</code>'s <code>cs</code> column shows the system-wide rate. Many voluntary switches mean the thread blocks a lot (on I/O or locks), and many involuntary ones mean the core is oversubscribed.</li>
<li><strong>Scheduling latency:</strong> <code>perf sched record</code> and <code>perf sched latency</code> show how long runnable threads waited for a core, which is often what a tail-latency problem really is.</li>
<li><strong>In a performance model:</strong> trace-driven and sampled simulation (SimPoint regions of one process) never see a switch, so they report warm-cache behavior. To estimate the cost, flush or pollute the caches, TLBs, and predictor tables at the measured switch interval, or simulate a full system that runs the OS. A predictor or prefetcher that needs a long time to train loses more of its benefit at each switch than one that trains quickly.</li>
</ul>
<p class="refs">References: Arpaci-Dusseau and Arpaci-Dusseau, <em>Operating Systems: Three Easy Pieces</em>, Chapters 6&ndash;10 (limited direct execution, scheduling, multiprocessor scheduling) · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Section 2.4 and Appendix B (protection and process switching) · Stoica and Abdel-Wahab, "Earliest Eligible Virtual Deadline First," 1995 · Linux kernel documentation, "EEVDF Scheduler" and "CFS Scheduler" · Li, Ding, and Shen, "Quantifying the Cost of Context Switch," ExpCS 2007 · Love, <em>Linux Kernel Development</em>, Chapter 4 (process scheduling)</p>
`,
  practice: {
    guided: [
      {
        q: `<p>An event-driven server on a 3.2 GHz core handles 40,000 requests per second on one thread. For each request, the thread blocks in <code>epoll_wait</code> and is woken when the request arrives, so every request costs 2 context switches (the switch away to the idle task and the switch back). Assume each switch costs 1.6 µs directly and 3 µs more in refilling caches and predictors, and nothing else runs on the core. Find:</p><ol><li>The fraction of the core the switches use, and whether <code>/proc</code> would report them as voluntary or involuntary.</li><li>The fraction if requests arrive in bursts so that each <code>epoll_wait</code> returns 8 requests on average.</li></ol>`,
        a: `<ol><li><strong>One request per wakeup:</strong> 40,000 &times; 2 = 80,000 switches per second, each 1.6 + 3 = 4.6 µs, so 80,000 &times; 4.6 µs = 368 ms per second, or <strong>36.8%</strong> of the core. They are <strong>voluntary</strong>, since the thread blocks itself.</li><li><strong>Eight per wakeup:</strong> the thread blocks 40,000 / 8 = 5,000 times per second, so 10,000 switches &times; 4.6 µs = 46 ms, or <strong>4.6%</strong>.</li></ol><p>Batching cuts the switch rate by 8. The alternative at very high rates is busy polling, which removes the switches but keeps the core at 100% even when idle.</p>`
      }
    ],
    interview: [
      {
        q: `<p>On Linux 6.6 or later with EEVDF, on a 16-core machine with the default 3 ms base slice, a latency-critical thread at nice 0 shares a core with a CPU-bound batch thread, also at nice 0. The latency thread wakes for each request and runs for about 50 µs. Its p99 latency is about 3 ms worse than when it has the core to itself. Explain the 3 ms and give three fixes.</p>`,
        a: `<p>Assume the batch thread never blocks and the machine has no idle core to move either thread to.</p><ul><li><strong>Why:</strong> when the latency thread wakes, it preempts the batch thread only if it is eligible and its virtual deadline is earlier. Both threads have the same weight and the same 3 ms slice, so the waking thread's deadline is often not earlier than the batch thread's current one. Then it waits until the batch thread's slice ends, which takes up to 3 ms. Over many requests, the tail is that worst case.</li><li><strong>Fix 1:</strong> give the latency thread a short slice with <code>sched_setattr</code> (for example 0.1 ms, kernel 6.12 or later). Its deadline then lands early, so it preempts on wakeup, and its share of the core doesn't change.</li><li><strong>Fix 2:</strong> demote the batch thread to <code>SCHED_IDLE</code> (or nice 19), so any wakeup of the latency thread preempts it.</li><li><strong>Fix 3:</strong> separate them: pin the latency thread to a core the batch thread can't use (cpusets), or make it <code>SCHED_FIFO</code>, which always preempts the fair class. Pinning also keeps the batch thread from evicting the latency thread's cache lines.</li></ul>`
      },
      {
        q: `<p>On a CPU with PCIDs, a CR3 write no longer flushes the TLB. Why is switching between two threads of the same process still cheaper than switching between two processes? Assume the process-switch path issues no IBPB.</p>`,
        a: `<p>A thread switch does strictly less work and keeps more useful state:</p><ul><li><strong>No CR3 write.</strong> Threads share the page-table root, so the switch skips the write, which is a serializing instruction that costs hundreds of cycles even without a flush.</li><li><strong>Shared translations and data.</strong> Both threads use the same TLB entries, page-walk cache entries, and cached lines for shared code, heap, and libraries. With PCIDs, the other process's entries survive, but they are useless to this process and they evict its entries, so the TLB holds two working sets instead of one.</li><li><strong>Limited PCIDs.</strong> Linux uses only 6 PCIDs per core. A core that cycles through more processes than that reuses PCIDs and flushes their old entries, so process switches lose even that benefit.</li></ul><p>The indirect cost depends on how much the two threads share. Two threads of one process working on disjoint data still evict each other's cache lines.</p>`
      },
      {
        q: `<p>A bulk-synchronous HPC code runs on 64 cores, one thread per core, and every iteration takes 100 µs of compute followed by a barrier. Each core has a timer tick at 1,000 Hz that steals 5 µs (handler plus refilled state). Assume the ticks on different cores are not aligned (Linux's <code>skew_tick=1</code>), so each core's tick falls at an independent random point. What fraction of time does one core lose to ticks, and how much does the application slow down? What changes with <code>nohz_full</code>?</p>`,
        a: `<ol><li><strong>One core:</strong> 1,000 &times; 5 µs = 5 ms per second, or <strong>0.5%</strong>.</li><li><strong>Per iteration:</strong> a tick lands in a given 100 µs window on a given core with probability 100 µs / 1 ms = 0.1. The chance that no core is hit is 0.9<sup>64</sup> &asymp; 0.0012, so <strong>about 99.9%</strong> of iterations have at least one delayed core.</li><li><strong>Slowdown:</strong> the barrier waits for the slowest core, so almost every iteration takes 105 µs instead of 100 µs: about <strong>5%</strong>, 10 times the per-core loss.</li><li><strong>With <code>nohz_full</code>:</strong> a core with a single runnable thread stops its tick (down to about once per second for housekeeping), so the jitter nearly disappears.</li></ol><p>With aligned ticks (the default <code>skew_tick=0</code>), every core is delayed in the same iteration, which happens in 1 of 10 iterations, so the slowdown would be about 0.5% instead.</p>`
      }
    ]
  }
},

{
  id: "sync",
  region: "task",
  title: "Locks and Synchronization",
  sections: [
    { id: "why", label: "Why Threads Need Locks" },
    { id: "spinlocks", label: "Spinlocks and Coherence Traffic" },
    { id: "kernel-spinlocks", label: "Spinlocks in the Kernel" },
    { id: "futex", label: "Sleeping Locks and the Futex" },
    { id: "read-mostly", label: "Read-Mostly Data: Seqlocks and RCU" },
    { id: "deadlock", label: "Deadlock" },
    { id: "inversion", label: "Priority Inversion" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p>Threads that share memory need a way to take turns on shared data. This page builds locks up from the hardware's atomic instructions: spinlocks and the coherence traffic they cause, how the kernel uses them, how user-space mutexes sleep through the futex system call, how read-mostly data avoids locks almost entirely, and the two classic ways locking goes wrong, deadlock and priority inversion. <a href="#/context-switch">Context Switching</a> covers what blocking costs, and <a href="#/c11-ordering">C11 Memory Ordering</a> covers the ordering rules that every lock below relies on. Main sources: Hennessy &amp; Patterson, Section 5.5, Herlihy and Shavit's <em>The Art of Multiprocessor Programming</em> (chapter 7), Mellor-Crummey and Scott's MCS lock paper, Ulrich Drepper's "Futexes Are Tricky," and Paul McKenney's <em>Is Parallel Programming Hard, And, If So, What Can You Do About It?</em></p>

<h3 id="sec-why">Why Threads Need Locks</h3>
<p><code>counter++</code> on shared memory is three operations: a load, an add, and a store. If two threads both load 7, both store 8, and one increment is lost. Any sequence of operations that must appear indivisible to other threads is a <strong>critical section</strong>, and a lock guarantees that at most one thread is inside it at a time. A correct lock needs three properties:</p>
<ul>
<li><strong>Mutual exclusion:</strong> at most one thread holds the lock.</li>
<li><strong>Progress:</strong> if the lock is free and threads want it, one of them gets it.</li>
<li><strong>Bounded waiting (fairness):</strong> a waiting thread is not passed over forever.</li>
</ul>
<p>Locks can be built from ordinary loads and stores (Peterson's algorithm), but only with a full store-to-load fence on any machine that reorders a store after a later load, as x86 and Arm both do (see <a href="#/consistency">Memory Consistency Models in Hardware</a>). Every real lock is built instead on an atomic read-modify-write instruction, which reads a location and writes it with no other core's write in between:</p>
<ul>
<li><strong>x86-64:</strong> <code>xchg</code> with memory and any instruction with the <code>lock</code> prefix (<code>lock cmpxchg</code>, <code>lock xadd</code>). The core takes the line in the modified state and holds off snoops to it until the operation completes, and the instruction is a full fence: the store buffer drains first.</li>
<li><strong>Arm64:</strong> load-exclusive and store-exclusive (<code>LDXR</code> and <code>STXR</code>), where the store fails and the loop retries if another core wrote the line in between. Armv8.1 added the LSE atomics (<code>CAS</code>, <code>SWP</code>, <code>LDADD</code>), single instructions that some implementations can execute at the shared cache or interconnect instead of pulling the line into the core.</li>
<li><strong>RISC-V:</strong> load-reserved and store-conditional (<code>LR</code> and <code>SC</code>) and the atomic memory operations (<code>AMOSWAP</code>, <code>AMOADD</code>) of the A extension.</li>
</ul>
<p>Compare-and-swap is enough to build any lock and any lock-free structure. Each primitive is cheap when the line is already in the core's L1 in the modified state. It becomes expensive when the line lives in another core's cache, and that is the subject of the rest of this page (the states are in <a href="#/mesi">Cache Coherence and MESI</a>).</p>

<h3 id="sec-spinlocks">Spinlocks and Coherence Traffic</h3>
<p>A <strong>spinlock</strong> waits by looping until the lock is free. The simplest one, <strong>test-and-set</strong>, loops on an atomic exchange. Each exchange is a write, so each one takes the line in the modified state and invalidates every other copy. With several waiters, the lock's line moves from core to core on every iteration, and the holder's release has to win the line back from them. <strong>Test-and-test-and-set</strong> fixes the steady state by spinning on a plain load:</p>
<pre><code>void lock(atomic_int *l) {
    for (;;) {
        if (!atomic_exchange_explicit(l, 1, memory_order_acquire))
            return;                       /* was 0: we hold it */
        while (atomic_load_explicit(l, memory_order_relaxed))
            _mm_pause();                  /* spin on a shared copy in our own L1 */
    }
}

void unlock(atomic_int *l) {
    atomic_store_explicit(l, 0, memory_order_release);
}</code></pre>
<p>While the lock is held, every waiter hits in its own L1 on a shared copy, so spinning causes no traffic. The trouble is the release. The holder's store invalidates every copy, every waiter misses and reads the line again, all of them see 0, and all of them try the exchange. One wins, and the rest fail but still take the line in the modified state, one after another. A single handoff costs a burst of coherence transactions that grows with the number of waiters, all serialized on one line (Anderson, 1990).</p>
<p>Three designs bound that burst:</p>
<ul>
<li><strong>Backoff:</strong> a waiter that fails waits a random, growing time before trying again. This cuts the traffic but leaves the lock idle while everyone is backing off.</li>
<li><strong>Ticket lock:</strong> an atomic increment of <code>next_ticket</code> hands each arriving thread a number, and the thread spins until <code>now_serving</code> equals it. The release increments <code>now_serving</code>. It is FIFO, and only the next owner sees its number, but the release still invalidates every waiter's copy, and the next owner's re-read waits in line with all the others. Linux on x86 used ticket spinlocks from 2.6.25 to 4.1.</li>
<li><strong>Queue lock (MCS):</strong> each waiter spins on a flag in its own node, in its own cache line, and the nodes form a queue. The lock word is just a pointer to the tail.</li>
</ul>
<pre><code>struct mcs_node {
    struct mcs_node *_Atomic next;
    atomic_int locked;
};

void mcs_lock(struct mcs_node *_Atomic *tail, struct mcs_node *me) {
    atomic_store(&amp;me-&gt;next, NULL);
    atomic_store(&amp;me-&gt;locked, 1);
    struct mcs_node *prev = atomic_exchange(tail, me);   /* join the queue */
    if (prev) {
        atomic_store(&amp;prev-&gt;next, me);
        while (atomic_load(&amp;me-&gt;locked))
            _mm_pause();                  /* nobody else touches this line */
    }
}

void mcs_unlock(struct mcs_node *_Atomic *tail, struct mcs_node *me) {
    struct mcs_node *next = atomic_load(&amp;me-&gt;next);
    if (!next) {
        struct mcs_node *expect = me;
        if (atomic_compare_exchange_strong(tail, &amp;expect, NULL))
            return;                       /* no one was waiting */
        while (!(next = atomic_load(&amp;me-&gt;next)))
            ;                             /* a successor is still linking in */
    }
    atomic_store(&amp;next-&gt;locked, 0);      /* hand off to exactly one waiter */
}</code></pre>
<p>An MCS handoff costs two line transfers no matter how many threads wait: the releaser's store pulls the successor's flag line over, and the successor's next load pulls it back. Linux's <strong>qspinlock</strong> (x86 since 4.2) packs this into a 4-byte word: a locked byte, a pending bit, and a tail that names a CPU and one of its four per-CPU MCS nodes (one each for task, softirq, hardirq, and NMI context). The first waiter spins on the word itself with the pending bit set, and only the third and later contenders queue on MCS nodes, so the common case of light contention never touches a node.</p>
<p>Two hardware details shape every spin loop:</p>
<ul>
<li><strong>Pause:</strong> x86's <code>pause</code> tells the core it is spinning. It avoids a memory-order machine clear when the line finally changes, saves power, and on an SMT core gives the sibling thread the execution resources. Its latency is about 140 cycles on Skylake server cores, up from about 10 on earlier ones, so a loop tuned in iterations behaves very differently across generations.</li>
<li><strong>Wait for event:</strong> Arm64 spinners pair a load-exclusive with <code>WFE</code>, which sleeps the core until the monitored line is written. Recent x86 cores offer <code>UMONITOR</code> and <code>UMWAIT</code> for the same purpose.</li>
</ul>

<h3 id="sec-kernel-spinlocks">Spinlocks in the Kernel</h3>
<p>The kernel uses spinlocks to protect data touched for short stretches, often from interrupt handlers, where sleeping is not allowed. Two rules follow from what can interrupt the holder:</p>
<ul>
<li><strong>Taking a spinlock disables preemption.</strong> If the holder were preempted, every other CPU that wants the lock would spin for the holder's whole time away. <code>spin_lock</code> raises the per-thread preemption count, which is also why the kernel may not reach a preemption point while holding a spinlock (see <a href="#/context-switch/preemption">Preemption Points</a>), and why sleeping while holding one is a bug ("scheduling while atomic").</li>
<li><strong>Data shared with an interrupt handler needs interrupts disabled.</strong> If code holding the lock is interrupted on its own CPU and the handler tries to take the same lock, the handler spins forever: the holder cannot run again until the handler returns. <code>spin_lock_irqsave</code> disables local interrupts for the critical section, and <code>spin_lock_bh</code> does the same for softirqs.</li>
</ul>
<p>Linux checks these rules at runtime with <strong>lockdep</strong>, which records every lock class's context and reports a lock that is taken both in an interrupt handler and elsewhere with interrupts enabled, before it has ever deadlocked. Under PREEMPT_RT, merged into mainline in 6.12, most <code>spinlock_t</code> locks become sleeping locks with priority inheritance and interrupt handlers run in threads, so only <code>raw_spinlock_t</code> still spins. That trades some throughput for bounded latency.</p>
<p>Virtualization adds one more problem: <strong>lock-holder preemption</strong>. The guest kernel disabled preemption, but the hypervisor can still deschedule the vCPU that holds the lock, and the other vCPUs spin for the rest of its host time slice. Intel's pause-loop exiting and AMD's pause filter count <code>pause</code> instructions and force a VM exit when a vCPU spins too long, and paravirtual qspinlocks let a waiting vCPU halt until the holder kicks it (see <a href="#/virtualization/vm-exits">VM Exits and Their Cost</a>).</p>

<h3 id="sec-futex">Sleeping Locks and the Futex</h3>
<p>Spinning wastes the waiter's core, which is fine for waits shorter than a context switch and wasteful for anything longer. A <strong>sleeping lock</strong> (mutex) blocks the waiter instead, but asking the kernel on every lock and unlock would cost a system call even when no one else wants the lock, which is almost always. The <strong>futex</strong> ("fast user-space mutex," Linux 2.6) splits the work: the lock word lives in user memory and the uncontended path is a single atomic instruction, and the kernel is involved only when a thread must sleep or wake one. It offers two basic operations on a 32-bit word:</p>
<ul>
<li><strong><code>FUTEX_WAIT(addr, val)</code>:</strong> sleep, but only if <code>*addr</code> still equals <code>val</code>. The kernel re-reads the word under the lock of the hash bucket that the address maps to, so a waker that changes the word and then calls <code>FUTEX_WAKE</code> cannot slip in between the check and the sleep. Without that check, the unlock could happen just before the waiter went to sleep, and the waiter would sleep forever (a <strong>lost wakeup</strong>).</li>
<li><strong><code>FUTEX_WAKE(addr, n)</code>:</strong> wake up to <code>n</code> threads sleeping on <code>addr</code>.</li>
</ul>
<p>Drepper's mutex encodes three states in the word: 0 for unlocked, 1 for locked with no waiters, and 2 for locked with possible waiters. Only state 2 makes the unlock call into the kernel:</p>
<pre><code>void mutex_lock(atomic_int *m) {
    int c = 0;
    if (atomic_compare_exchange_strong(m, &amp;c, 1))
        return;                           /* fast path: 0 -&gt; 1, no system call */
    if (c != 2)
        c = atomic_exchange(m, 2);        /* announce a waiter */
    while (c != 0) {
        futex_wait(m, 2);                 /* sleep while the word is still 2 */
        c = atomic_exchange(m, 2);
    }
}

void mutex_unlock(atomic_int *m) {
    if (atomic_fetch_sub(m, 1) != 1) {    /* it was 2: someone may be asleep */
        atomic_store(m, 0);
        futex_wake(m, 1);
    }
}</code></pre>
<p>A thread that wakes sets the word back to 2, not 1, because it cannot know whether others are still asleep. The cost is an occasional wake call with no one to wake. glibc's <code>pthread_mutex_t</code>, condition variables, semaphores, and <code>pthread_join</code> are all built on futexes. The kernel keys a private futex (the default for process-local locks) by address space and virtual address, and a shared one by the backing page and offset, so two processes can share a lock in a <code>MAP_SHARED</code> region. Windows offers the same split through <code>WaitOnAddress</code> and <code>WakeByAddressSingle</code>, which its slim reader-writer locks use.</p>
<p>Most mutexes also spin briefly before sleeping. The kernel's own <code>mutex</code> spins as long as the owner is running on another CPU, since the owner is then likely to release soon, and sleeps as soon as the owner is not running. glibc offers the same idea as <code>PTHREAD_MUTEX_ADAPTIVE_NP</code>.</p>

<details class="ex"><summary>Worked example: what a handoff costs</summary>
<p><strong>Question.</strong> 32 threads, each on its own core, loop forever doing 10 µs of private work and then a 400 ns critical section under one lock. Assume:</p>
<ul>
<li>A cache-line transfer between cores takes 60 ns.</li>
<li>With an MCS lock, a handoff takes 2 line transfers.</li>
<li>With a sleeping lock that hands the lock directly to the longest-sleeping waiter (no barging), every handoff under contention waits for the waiter to wake and be switched in, which takes 4 µs.</li>
<li>The lock's throughput is bounded by one critical section plus one handoff per acquisition.</li>
</ul>
<p>Find each lock's maximum acquisition rate, whether 32 threads saturate it, and the fraction of each thread's time spent waiting.</p>
<p><strong>Solution.</strong></p>
<ol>
<li><strong>Demand:</strong> without waiting, each thread acquires once per 10 + 0.4 = 10.4 µs, so 32 threads ask for 32 / 10.4 µs &asymp; <strong>3.08 million</strong> acquisitions per second.</li>
<li><strong>MCS ceiling:</strong> a handoff is 2 &times; 60 = 120 ns, so each acquisition occupies the lock for 400 + 120 = 520 ns, and the ceiling is 1 / 520 ns &asymp; <strong>1.92 million</strong> per second. Demand exceeds it, so the lock is saturated.</li>
<li><strong>MCS waiting:</strong> at the ceiling, each thread completes a loop every 32 &times; 0.52 µs = 16.64 µs, of which 10.4 µs is useful, so each thread waits 6.24 / 16.64 = <strong>37.5%</strong> of the time.</li>
<li><strong>Sleeping-lock ceiling:</strong> each acquisition occupies the lock for 0.4 + 4 = 4.4 µs, so the ceiling is 1 / 4.4 µs &asymp; <strong>227,000</strong> per second, 8.5 times lower than MCS.</li>
<li><strong>Sleeping-lock waiting:</strong> each loop takes 32 &times; 4.4 µs = 140.8 µs, so each thread waits (140.8 &minus; 10.4) / 140.8 &asymp; <strong>92.6%</strong> of the time.</li>
</ol>
<p>Once the lock is saturated, strict handoff to sleeping waiters puts a full wakeup into every handoff, and the threads form a <strong>lock convoy</strong>. That is why glibc's default mutex is not FIFO: a running thread that arrives while the woken one is still being scheduled may take the lock first (barging), which keeps the handoff near the cost of a line transfer at the price of fairness.</p>
</details>

<h3 id="sec-read-mostly">Read-Mostly Data: Seqlocks and RCU</h3>
<p>Much kernel data is read constantly and changed rarely: routing tables, the directory-entry cache, the list of tasks, the current time. A reader-writer lock lets readers in together, but every reader still increments and decrements a shared count, so the count's line bounces between readers' cores even when no writer ever comes. Two designs remove writes from the read path entirely.</p>
<p><strong>Seqlocks.</strong> The writer, serialized by a spinlock, increments a sequence count before and after its update, so the count is odd during a write. A reader samples the count, reads the data, and samples it again, retrying if the count was odd or changed:</p>
<pre><code>do {
    seq = read_seqbegin(&amp;tk_lock);     /* wait while odd, then acquire */
    now = tk.xtime;                     /* may be torn, checked below */
} while (read_seqretry(&amp;tk_lock, seq));</code></pre>
<p>Readers never write a shared line, so they scale perfectly, but they may read a half-updated copy and must discard it. That rules out following pointers that the writer might free. Linux protects its timekeeping data this way, and the vDSO's <code>clock_gettime</code> reads the time in user mode with the same retry loop, with no system call.</p>
<p><strong>Read-copy-update (RCU).</strong> Readers follow a pointer to the data with no lock at all. A writer never changes data in place: it copies the object, edits the copy, publishes the copy by storing the new pointer, waits until every reader that might still hold the old pointer has finished, and only then frees the old object:</p>
<pre><code>/* reader */
rcu_read_lock();
struct route *r = rcu_dereference(tbl-&gt;slot[h]);
send_to(r-&gt;gateway);
rcu_read_unlock();

/* writer, holding the table's spinlock */
struct route *new = kmalloc(sizeof *new, GFP_KERNEL);
*new = *old;
new-&gt;gateway = gw;
rcu_assign_pointer(tbl-&gt;slot[h], new);   /* release store: new is complete first */
synchronize_rcu();                        /* wait for a grace period */
kfree(old);</code></pre>
<ul>
<li><strong>Grace period:</strong> readers may not block inside a read-side section, so once every CPU has context-switched, gone idle, or run in user mode, no reader can still hold the old pointer. In a non-preemptible kernel, <code>rcu_read_lock</code> therefore compiles to almost nothing. A grace period takes milliseconds, so writers that cannot wait use <code>call_rcu</code> or <code>kfree_rcu</code> to free the object later.</li>
<li><strong>The hardware dependency:</strong> <code>rcu_dereference</code> is an ordinary load. It relies on the CPU never reading through a pointer's target before the pointer itself (address-dependency ordering), which x86, Arm, POWER, and RISC-V all guarantee. Alpha did not, and needed a barrier there.</li>
<li><strong>Beyond the kernel:</strong> user-space RCU (liburcu) and hazard pointers solve the same "when is it safe to free" problem, and both are in C++26.</li>
</ul>

<h3 id="sec-deadlock">Deadlock</h3>
<p>A set of threads is <strong>deadlocked</strong> when each waits for a lock held by another in the set. Coffman, Elphick, and Shoshani (1971) showed it needs four conditions at once:</p>
<ol>
<li><strong>Mutual exclusion:</strong> a lock has one holder.</li>
<li><strong>Hold and wait:</strong> a thread holds one lock while it waits for another.</li>
<li><strong>No preemption:</strong> a lock can't be taken away from its holder.</li>
<li><strong>Circular wait:</strong> the waits form a cycle.</li>
</ol>
<p>The classic case is two threads taking the same two locks in opposite orders:</p>
<pre><code>/* thread 0 */                  /* thread 1 */
lock(&amp;acct_a);                  lock(&amp;acct_b);
lock(&amp;acct_b);  /* waits */     lock(&amp;acct_a);  /* waits */</code></pre>
<p>Breaking any one condition prevents deadlock, and in practice the one broken is circular wait: every lock gets a place in a global order, and code takes locks only in that order, for example by address when two locks of the same type are involved. The Linux memory manager writes its order down in a comment at the top of <code>mm/rmap.c</code>, and lockdep enforces orders at runtime: it records each order in which two lock classes are ever taken and reports any new order that would close a cycle, even if the threads involved never actually collided. Breaking hold-and-wait with <code>trylock</code> (take the second lock if free, otherwise release the first and retry) works too, but two threads can then keep backing off in step forever, which is <strong>livelock</strong>. Single-lock deadlocks exist as well: a thread that takes a non-recursive mutex it already holds, or a spinlock its own interrupt handler wants, waits for itself.</p>

<h3 id="sec-inversion">Priority Inversion</h3>
<p>Locks interfere with priority scheduling. Suppose a low-priority thread L holds a lock that a high-priority thread H needs. H blocks, which is expected, since L will finish soon. But if a medium-priority thread M becomes runnable, it preempts L, and as long as M runs, L can't release the lock and H can't run. A thread that doesn't touch the lock at all has delayed the highest-priority thread for an unbounded time. That is <strong>priority inversion</strong>.</p>
<p>It reset the Mars Pathfinder lander repeatedly in July 1997. A low-priority meteorological task held a VxWorks mutex protecting the lander's information bus, a medium-priority communications task ran long, and the high-priority bus-management task missed its deadline, which a watchdog treated as a fault and answered with a full system reset. The engineers reproduced it on a ground copy and uploaded a fix that turned on priority inheritance for that mutex.</p>
<ul>
<li><strong>Priority inheritance:</strong> while H waits, L runs at H's priority, so M can't preempt it. The boost passes along chains of locks and ends when L releases. On Linux, <code>PTHREAD_PRIO_INHERIT</code> mutexes use PI futexes (<code>FUTEX_LOCK_PI</code>), where the kernel tracks the owner through the futex word and boosts it, and the kernel's own <code>rt_mutex</code> does the same.</li>
<li><strong>Priority ceiling:</strong> each lock has a ceiling equal to the highest priority of any thread that uses it, and a thread holding it runs at that ceiling (<code>PTHREAD_PRIO_PROTECT</code>). This needs the priorities known in advance but also prevents some deadlocks (Sha, Rajkumar, and Lehoczky, 1990).</li>
</ul>
<p>Ordinary time-sharing schedulers avoid the worst of it by accident: a fair scheduler eventually runs L anyway. Inversion becomes unbounded only under strict priorities, which is why it matters most in real-time systems.</p>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong>Uncontended locks are cheap but not free.</strong> An atomic read-modify-write on a line already in the L1 costs roughly 10 to 20 cycles on recent x86 cores, mostly because it is a full fence and waits for the store buffer to drain. A lock and unlock per small operation still shows up in profiles.</li>
<li><strong>Contended locks cost line transfers.</strong> Once threads compete, the instruction hardly matters and the time goes to moving the lock's line: tens of nanoseconds between cores of one socket and 100 to 200 ns across sockets. The data protected by the lock moves too, since each new owner misses on whatever the previous owner wrote. Keep read-mostly fields off the lock's line (see <a href="#/false-sharing">False Sharing and Cache-Line Isolation</a>).</li>
<li><strong>Spin or sleep.</strong> Spinning wastes the waiter's core but hands off in nanoseconds, while sleeping frees the core but adds microseconds to every handoff. Spinning for as long as a block-and-wake would cost, then sleeping, never costs more than twice the best choice made in hindsight (Karlin, Li, Manasse, and Owicki, 1991). Adaptive mutexes apply a version of this rule.</li>
<li><strong>Fair locks can be slow locks.</strong> FIFO handoff to a sleeping waiter turns every handoff into a wakeup (see the worked example), and ticket locks lose throughput badly when the holder's vCPU or thread is descheduled, since every later ticket must wait for it. Barging trades fairness for throughput.</li>
<li><strong>Spinning inflates IPC.</strong> A spin loop retires loads and branches that hit in the L1 at a high IPC and does no work, so a contended run can show higher IPC and more instructions while finishing less. Measure multi-threaded workloads in work per second or time per operation, not IPC (Alameldeen and Wood, 2006).</li>
<li><strong>For a simulator:</strong> syscall-emulation mode (gem5 SE) handles futex waits and wakes inside the simulator with little or none of the kernel's microseconds, so blocking looks almost free. User-level traces miss kernel lock contention altogether. If locks matter, use full-system simulation, and compare runs by completed work rather than instructions committed.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Section 5.5 (synchronization) · Herlihy and Shavit, <em>The Art of Multiprocessor Programming</em>, chapter 7 (spin locks and contention) · Anderson, "The Performance of Spin Lock Alternatives for Shared-Memory Multiprocessors," IEEE TPDS 1990 · Mellor-Crummey and Scott, "Algorithms for Scalable Synchronization on Shared-Memory Multiprocessors," ACM TOCS 1991 · Franke, Russell, and Kirkwood, "Fuss, Futexes and Furwocks," Ottawa Linux Symposium 2002 · Drepper, "Futexes Are Tricky," 2011 · McKenney, <em>Is Parallel Programming Hard, And, If So, What Can You Do About It?</em> (RCU and seqlocks) · Coffman, Elphick, and Shoshani, "System Deadlocks," ACM Computing Surveys 1971 · Sha, Rajkumar, and Lehoczky, "Priority Inheritance Protocols," IEEE Transactions on Computers 1990 · Karlin, Li, Manasse, and Owicki, "Empirical Studies of Competitive Spinning for a Shared-Memory Multiprocessor," SOSP 1991 · Alameldeen and Wood, "IPC Considered Harmful for Multiprocessor Workloads," IEEE Micro 2006 · Linux kernel documentation, "Lock types and their rules" and "Runtime locking correctness validator" · Arpaci-Dusseau and Arpaci-Dusseau, <em>Operating Systems: Three Easy Pieces</em>, Chapters 28&ndash;32</p>`,
  practice: {
    guided: [
      {
        q: `<p>Three threads use Drepper's three-state futex mutex from this page. The mutex word starts at 0. Thread A locks it. While A holds it, thread B calls <code>mutex_lock</code> and then thread C calls <code>mutex_lock</code>, and both go to sleep. A unlocks, B runs its critical section and unlocks, and then C runs its critical section and unlocks. No other thread touches the mutex, the kernel wakes sleepers in the order they went to sleep, and there are no spurious wakeups.</p><ol><li>Trace the mutex word through every step.</li><li>How many futex system calls are made in total, and which of them does no useful work?</li><li>How many system calls would a lock and unlock with no contention make?</li></ol>`,
        a: `<ol><li><strong>A locks:</strong> the compare-and-swap turns 0 into 1. Word = 1, no system call.</li><li><strong>B locks:</strong> the compare-and-swap fails and returns c = 1. Since c &ne; 2, B exchanges in 2 and gets back 1, which is not 0, so it calls <code>futex_wait(m, 2)</code>. The word is 2, so B sleeps. Word = 2. <strong>System call 1.</strong></li><li><strong>C locks:</strong> the compare-and-swap fails and returns c = 2, so C skips the exchange and calls <code>futex_wait(m, 2)</code> and sleeps. Word = 2. <strong>System call 2.</strong></li><li><strong>A unlocks:</strong> <code>fetch_sub</code> returns 2 (word now 1), which is not 1, so A stores 0 and calls <code>futex_wake(m, 1)</code>, waking B. Word = 0. <strong>System call 3.</strong></li><li><strong>B wakes:</strong> it exchanges in 2 and gets back 0, so it holds the lock. Word = 2, even though only C is still waiting.</li><li><strong>B unlocks:</strong> <code>fetch_sub</code> returns 2, so B stores 0 and wakes C. Word = 0. <strong>System call 4.</strong></li><li><strong>C wakes:</strong> it exchanges in 2, gets back 0, and holds the lock. Word = 2, although nobody is left waiting.</li><li><strong>C unlocks:</strong> <code>fetch_sub</code> returns 2, so C stores 0 and calls <code>futex_wake</code>, which finds no sleeper. Word = 0. <strong>System call 5</strong>, the wasted one.</li><li><strong>Total:</strong> 5 futex calls, 2 waits and 3 wakes. The last wake is unnecessary because a woken thread can't tell whether others still sleep, so it always sets the word to 2. Tracking the exact number of waiters would need a second shared counter and more atomics on every path.</li><li><strong>No contention:</strong> one compare-and-swap to lock and one <code>fetch_sub</code> returning 1 to unlock, so <strong>0</strong> system calls. That is the case the design optimizes.</li></ol>`
      },
      {
        q: `<p>On a server, putting a waiting thread to sleep and waking it again costs 3.2 µs of CPU time in all (two context switches and the futex calls). Lock waits in a service have two kinds: 70% of waits last 0.5 µs, and 30% last 40 µs. Count only the waiting thread's CPU time, and treat a wait as ending the instant the lock is released. Compare the expected CPU time per wait for:</p><ol><li>Always spinning.</li><li>Always sleeping immediately.</li><li>Spinning for up to 3.2 µs, then sleeping.</li><li>An oracle that knows each wait's length in advance.</li></ol><p>How far is the third strategy from the oracle, and what is its worst case?</p>`,
        a: `<ol><li><strong>Always spin:</strong> 0.7 &times; 0.5 + 0.3 &times; 40 = 0.35 + 12 = <strong>12.35 µs</strong>.</li><li><strong>Always sleep:</strong> every wait costs the block and wake, <strong>3.2 µs</strong>, even the short ones.</li><li><strong>Spin, then sleep:</strong> a short wait ends after 0.5 µs of spinning. A long wait spins the full 3.2 µs and then sleeps for another 3.2 µs, 6.4 µs in all. Expected = 0.7 &times; 0.5 + 0.3 &times; 6.4 = 0.35 + 1.92 = <strong>2.27 µs</strong>.</li><li><strong>Oracle:</strong> spin on short waits (0.5 µs) and sleep at once on long ones (3.2 µs). Expected = 0.35 + 0.3 &times; 3.2 = 0.35 + 0.96 = <strong>1.31 µs</strong>.</li><li>The third strategy costs 2.27 / 1.31 &asymp; <strong>1.73 times</strong> the oracle here. Its worst case is a wait just longer than 3.2 µs: it spends 3.2 µs spinning and 3.2 µs sleeping, 6.4 µs, where the oracle would spend 3.2 µs, a ratio of <strong>2</strong>. No strategy that can't see the future does better than 2 in the worst case.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>On one 56-core Sapphire Rapids socket, a lock protects a 100 ns critical section. Compare a ticket lock and an MCS lock with 4 and with 56 threads, each on its own core and always waiting for the lock. Assume:</p><ul><li>A cache-line transfer between cores takes 70 ns, and transfers of the same line are served one at a time.</li><li>Ticket lock: the release's store takes one transfer and invalidates every waiter's copy. The waiters' re-reads are then served one at a time in random order, and the handoff completes when the next owner's re-read is served.</li><li>MCS lock: a handoff takes 2 transfers.</li><li>Throughput is one critical section plus one handoff per acquisition.</li></ul><p>Find each lock's acquisition rate in both cases and explain the difference.</p>`,
        a: `<ol><li><strong>Ticket handoff with <em>N</em> waiters:</strong> 1 transfer for the release, then the next owner's re-read is equally likely to be any of positions 1 to <em>N</em>, so it waits (<em>N</em> + 1) / 2 transfers on average. Handoff = 1 + (<em>N</em> + 1) / 2 transfers.</li><li><strong>4 threads (3 waiters):</strong> 1 + 2 = 3 transfers = 210 ns, so the ticket lock runs at 1 / (100 + 210) ns &asymp; <strong>3.23 million</strong> per second. MCS: 2 &times; 70 = 140 ns, so 1 / 240 ns &asymp; <strong>4.17 million</strong> per second.</li><li><strong>56 threads (55 waiters):</strong> 1 + 28 = 29 transfers = 2,030 ns, so the ticket lock runs at 1 / 2,130 ns &asymp; <strong>469,000</strong> per second. MCS is unchanged at <strong>4.17 million</strong>.</li><li>The ticket lock's handoff grows linearly with the waiters because every waiter spins on the same line, and the release makes all of them re-read it, even though only one of them can use the news. MCS waiters spin on separate lines, so a release touches exactly one of them. At 56 threads the ticket lock is about 8.9 times slower, which is why Linux replaced ticket spinlocks with the MCS-based qspinlock.</li><li>Assumed and not modeled: the protected data's own misses, which add the same cost to both locks, and the pending-bit fast path qspinlock adds for light contention.</li></ol>`
      },
      {
        q: `<p>A Linux system has one core. Three <code>SCHED_FIFO</code> threads share it: L at priority 10, M at priority 50, and H at priority 90. L takes a default (non-PI) <code>pthread_mutex_t</code> for a critical section that needs 30 µs more of CPU time. H then wakes and blocks on the mutex. Immediately afterward, M wakes with 200 ms of CPU-bound work that never touches the mutex. Real-time throttling is off. How long does H wait, and how does <code>PTHREAD_PRIO_INHERIT</code> change it?</p>`,
        a: `<ol><li>When H blocks, L is the highest-priority runnable thread and resumes its critical section. Then M wakes at priority 50, above L's 10, and preempts L.</li><li>M runs its full 200 ms, since nothing higher is runnable: H is blocked on the mutex and L has lower priority. Only then does L finish its remaining 30 µs and unlock, which wakes H.</li><li>H waits about 200 ms + 30 µs &asymp; <strong>200 ms</strong>, almost all of it caused by a thread that never touched the mutex. That is priority inversion, the bug that reset Mars Pathfinder.</li><li><strong>With <code>PTHREAD_PRIO_INHERIT</code></strong>, glibc locks the mutex with a PI futex. When H blocks, the kernel boosts L to priority 90, so M's wakeup doesn't preempt L. L finishes in 30 µs and unlocks, the kernel drops L back to 10 and hands the mutex to H, and H waits about <strong>30 µs</strong> plus the switch.</li><li>On more cores the inversion needs more medium-priority threads, one busy thread per core that could otherwise run L, but it is the same bug.</li></ol>`
      },
      {
        q: `<p>A Linux network driver keeps a statistics structure protected by a <code>spinlock_t</code>. Its <code>ioctl</code> path takes the lock with <code>spin_lock</code> to read the statistics, and its receive interrupt handler takes it with <code>spin_lock</code> to update them. The kernel is not PREEMPT_RT. Under heavy traffic, a CPU occasionally hangs with its interrupts disabled. Why, why does it never happen when the interrupt lands on a different CPU, and what is the fix?</p>`,
        a: `<ol><li>The <code>ioctl</code> path takes the lock with interrupts still enabled. If the receive interrupt arrives on that same CPU while the lock is held, the handler runs on top of the <code>ioctl</code> code and spins on the lock.</li><li>The holder is the code the handler interrupted. It can't run again until the handler returns, and the handler can't return until the holder releases. The CPU spins forever, with interrupts disabled because it is inside a handler.</li><li>If the interrupt lands on a different CPU, the handler spins there while the holder keeps running on its own CPU, releases the lock, and lets the handler proceed. The deadlock needs both on one CPU.</li><li><strong>Fix:</strong> take the lock in the <code>ioctl</code> path with <code>spin_lock_irqsave</code> (and <code>spin_unlock_irqrestore</code>), so the interrupt can't arrive on that CPU during the critical section. The handler can keep plain <code>spin_lock</code>, since Linux runs hard interrupt handlers with local interrupts disabled.</li><li>lockdep would have reported it on the first run in which the lock was taken in both contexts, as an inconsistent lock state between hard-interrupt and interrupts-enabled use, without waiting for the race.</li></ol>`
      },
      {
        q: `<p>A key-value server runs at 3.0 GHz with one thread per core. With 4 threads, it serves 2.0 million operations per second at an IPC of 1.1 per core. With 8 threads it serves only 1.6 million per second, yet its IPC per core rises to 1.6. Assume that with 4 threads the server's one global lock is almost never contended, and that the useful instructions per operation don't change. What fraction of the instructions at 8 threads do no useful work, and what happened? Which metric should the evaluation report instead?</p>`,
        a: `<ol><li><strong>4 threads:</strong> 4 &times; 3.0 &times; 10<sup>9</sup> &times; 1.1 = 13.2 &times; 10<sup>9</sup> instructions per second, divided by 2.0 &times; 10<sup>6</sup> operations, is <strong>6,600</strong> instructions per operation. With no contention, all of them are useful.</li><li><strong>8 threads:</strong> 8 &times; 3.0 &times; 10<sup>9</sup> &times; 1.6 = 38.4 &times; 10<sup>9</sup> instructions per second, divided by 1.6 &times; 10<sup>6</sup>, is <strong>24,000</strong> instructions per operation.</li><li>Wasted: (24,000 &minus; 6,600) / 24,000 = <strong>72.5%</strong> of the instructions.</li><li>The global lock is now contended, and waiters spin. A spin loop is a load that hits in the L1, a compare, and a branch that predicts well, so it retires at a high IPC while doing nothing, and it raises the average IPC even as throughput falls.</li><li>Report operations per second, or cycles per operation, which goes from 3.0 &times; 10<sup>9</sup> &times; 4 / 2.0 &times; 10<sup>6</sup> = 6,000 to 3.0 &times; 10<sup>9</sup> &times; 8 / 1.6 &times; 10<sup>6</sup> = 15,000 cycles of core time per operation. Alameldeen and Wood make this point for simulation studies: IPC is not a valid comparison when threads can spin. Fixes on the software side are a <code>pause</code> in the spin loop, a queue or sleeping lock, or splitting the global lock.</li></ol>`
      }
    ]
  }
}
]);
