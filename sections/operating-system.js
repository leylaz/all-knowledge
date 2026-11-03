/* Section: Operating system
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "os"). */

section({
  id: "os",
  name: "Operating System",
  cap: "Faults, traps, kernel entry, context switching, scheduling, demand paging, page replacement, copy-on-write, mmap, file and process system calls",
  sections: [
    { id: "what-os", label: "What an Operating System Is" },
    { id: "what-it-does", label: "What It Does" },
    { id: "kernel", label: "The Kernel" },
    { id: "shell", label: "The Shell" }
  ],
  body: `
<h3 id="sec-what-os">What an Operating System Is</h3>
<p>An <strong>operating system</strong> (OS) is the software layer between the hardware and the programs that run on it. Programs never drive the cores, DRAM, disks, or network card directly. They ask the OS, and the OS does the work on their behalf. Linux, Windows, macOS, Android, and iOS are general-purpose operating systems, and real-time systems such as FreeRTOS and Zephyr run on microcontrollers where meeting deadlines matters more than throughput.</p>
<p>Textbooks describe the OS in two complementary ways:</p>
<ul>
<li><strong>A resource manager:</strong> many programs want the same cores, memory, and devices at the same time. The OS decides who gets what, for how long, and keeps one program from taking resources that belong to another.</li>
<li><strong>An extended machine:</strong> raw hardware is awkward to use (disk sectors, physical addresses, device registers). The OS hides it behind cleaner abstractions: <strong>processes</strong> instead of cores, <strong>virtual address spaces</strong> instead of physical DRAM, <strong>files</strong> instead of disk blocks, and <strong>sockets</strong> instead of network card queues.</li>
</ul>
<p>The word "operating system" is used narrowly and broadly. Narrowly, it means just the <a href="#/r/os/kernel">kernel</a>, the part that is always in memory and runs with full hardware privilege. Broadly, it also includes the system programs shipped with it: the <a href="#/r/os/shell">shell</a>, the init system (systemd on most Linux distributions), the C library, the window system, and the standard utilities.</p>

<h3 id="sec-what-it-does">What It Does</h3>
<ul>
<li><strong>Managing hardware:</strong> sharing the cores, memory, and devices among programs, and hiding device differences behind drivers.</li>
<li><strong>Running applications:</strong> loading programs, turning them into processes, scheduling them, and giving them services through system calls.</li>
<li><strong>Handling files and storage:</strong> organizing persistent data into named files and directories, and caching it in memory.</li>
<li><strong>Security and protection:</strong> keeping programs and users from reading or corrupting what isn't theirs.</li>
<li><strong>Enabling user interaction:</strong> command lines, graphical desktops, and touch screens, plus the input and display paths behind them.</li>
<li><strong>Networking and communication:</strong> moving data between processes on one machine and between machines.</li>
</ul>

<h4 id="sec-hardware">Managing Hardware</h4>
<ul>
<li><strong>Cores:</strong> a periodic timer interrupt hands control back to the kernel even when a program never gives it up, so the scheduler can share each core among many threads (see <a href="#/context-switch">Context Switching</a>). The kernel also manages power. It picks voltage and frequency levels (cpufreq governors on Linux) and puts idle cores into sleep states (C-states).</li>
<li><strong>Memory:</strong> the kernel tracks every physical page frame, builds the page tables that map each process's virtual addresses to frames, fills pages in on first touch, and evicts them to disk under pressure (see <a href="#/demand-paging">Demand Paging and Copy-on-Write</a> and <a href="#/page-replacement">Page Replacement</a>).</li>
<li><strong>Devices:</strong> each device is run by a <strong>driver</strong>, kernel code that knows its registers, interrupts, and DMA engine. Drivers present a few standard interfaces (block devices for disks, character devices for serial ports and terminals, network interfaces for NICs), so the rest of the system doesn't care which vendor's SSD is installed. Drivers make up the majority of the Linux source tree.</li>
<li><strong>Interrupts and DMA:</strong> devices raise interrupts when they finish, so a core doesn't spin waiting for a slow disk. DMA lets the device copy data to and from memory without the core moving each byte.</li>
</ul>

<h4 id="sec-applications">Running Applications</h4>
<ul>
<li><strong>Loading:</strong> <code>execve</code> reads the executable's ELF headers, maps its code and data segments into a fresh address space, builds the initial stack with the arguments and environment, and jumps to the dynamic linker or the entry point (see <a href="#/r/comp">Compilers and the Toolchain</a> and <a href="#/process-syscalls">Process System Calls</a>).</li>
<li><strong>Processes and threads:</strong> a <strong>process</strong> is a running program plus everything the kernel tracks for it: its address space, open files, credentials, and one or more <strong>threads</strong>. Threads of one process share its memory and files, and each has its own registers and stack.</li>
<li><strong>Scheduling:</strong> the scheduler picks which ready thread runs on each core and for how long. Linux used CFS (the Completely Fair Scheduler) for years and switched to EEVDF in version 6.6. Its goals pull against each other: throughput, fast response for interactive work, fairness, and keeping caches warm.</li>
<li><strong>System calls:</strong> programs ask for services (read a file, allocate memory, create a process) through a controlled entry into the kernel (see <a href="#/exceptions/system-calls">System Calls</a>).</li>
<li><strong>Isolation and communication:</strong> each process has its own address space, so a crash in one doesn't corrupt another. When processes do need to cooperate, the OS provides pipes, shared memory, signals, and sockets.</li>
</ul>

<h4 id="sec-files">Handling Files and Storage</h4>
<ul>
<li><strong>The file abstraction:</strong> a file is a named sequence of bytes that outlives the process that wrote it. Directories arrange files in a tree. The <strong>file system</strong> (ext4, XFS, NTFS, APFS) decides which disk blocks hold each file and keeps the metadata (size, owner, permissions, timestamps) in structures such as inodes.</li>
<li><strong>One interface:</strong> programs use <code>open</code>, <code>read</code>, <code>write</code>, and <code>close</code> on small integer file descriptors, no matter which file system or device is underneath (see <a href="#/file-syscalls">File System Calls</a>). Unix extends the same interface to devices, pipes, and sockets, which is where "everything is a file" comes from.</li>
<li><strong>The page cache:</strong> the kernel keeps recently used file data in spare DRAM, so most reads never touch the disk, and writes land in memory and are flushed later. A program that needs its data on disk now calls <code>fsync</code>.</li>
<li><strong>Crash consistency:</strong> journaling file systems write a log of each metadata change before applying it, so a power failure leaves the file system consistent rather than half-updated.</li>
</ul>

<h4 id="sec-security">Security and Protection</h4>
<ul>
<li><strong>Privilege levels:</strong> the hardware runs user programs in an unprivileged mode (ring 3 on x86, EL0 on Arm) and the kernel in a privileged one (ring 0, EL1). Only privileged code can change page tables, mask interrupts, or touch device registers, so a program can't bypass the OS (see <a href="#/exceptions/privilege-levels">Privilege Levels</a>).</li>
<li><strong>Memory isolation:</strong> each process sees only its own page tables. Permission bits in each entry mark pages readable, writable, executable, or kernel-only, and an access that breaks them faults into the kernel.</li>
<li><strong>Users and access control:</strong> every process runs as a user. Files carry an owner and read, write, and execute permissions for the owner, the group, and everyone else, and access control lists refine them further. The superuser (root on Unix, Administrator on Windows) bypasses most checks.</li>
<li><strong>Hardening:</strong> address space layout randomization (ASLR) makes addresses hard to guess, sandboxes such as seccomp limit which system calls a process may make, and kernel page-table isolation (KPTI) keeps kernel memory unmapped while user code runs to block Meltdown. KPTI switches page tables on every kernel entry and exit, which makes system calls measurably slower.</li>
</ul>

<h4 id="sec-interaction">Enabling User Interaction</h4>
<ul>
<li><strong>Interfaces:</strong> a command-line interface (a <a href="#/r/os/shell">shell</a> in a terminal), a graphical interface (windows, menus, a mouse), or a touch interface on phones and tablets.</li>
<li><strong>The input path:</strong> a key press raises an interrupt, the keyboard driver turns it into an input event, and the kernel hands it to the terminal or to the window system, which delivers it to the application that has focus.</li>
<li><strong>The output path:</strong> applications draw into buffers, and a compositor (a Wayland compositor on Linux, the Desktop Window Manager on Windows) combines the windows into one frame that the GPU driver puts on the screen.</li>
<li><strong>Terminals:</strong> a terminal emulator and the programs in it talk through a pseudo-terminal, a kernel device that carries keystrokes one way and text output the other, and also handles line editing and Ctrl-C.</li>
</ul>

<h4 id="sec-networking">Networking and Communication</h4>
<ul>
<li><strong>The protocol stack:</strong> the kernel implements TCP, UDP, and IP, so programs send and receive byte streams or datagrams without building packets themselves.</li>
<li><strong>Sockets:</strong> a socket is a file descriptor for a network connection, so the same <code>read</code> and <code>write</code> calls work on it.</li>
<li><strong>NIC drivers:</strong> the driver moves packets between the network card's DMA rings and kernel buffers and spreads incoming traffic across cores.</li>
</ul>

<h3 id="sec-kernel">The Kernel</h3>
<p>The <strong>kernel</strong> is the core of the OS: the code that stays in memory from boot to shutdown, runs in privileged mode, and is the only software allowed to touch the hardware directly. Everything else, including the shell and every application, runs in user mode and reaches the hardware only by asking the kernel.</p>
<p>The kernel isn't a separate program running beside the others. It runs only when something enters it:</p>
<ul>
<li><strong>A system call:</strong> a program asks for a service.</li>
<li><strong>An exception:</strong> a program does something that needs the kernel's help, such as touching an unmapped page or dividing by zero.</li>
<li><strong>An interrupt:</strong> a device or the timer needs attention.</li>
</ul>
<p>Each entry saves the user state, runs a handler in kernel mode on that thread's kernel stack, and returns (see <a href="#/exceptions">Faults, Traps, Interrupts, and System Calls</a>). On Linux, the kernel is mapped into the upper half of every process's address space, so entering it doesn't require switching address spaces (except with KPTI). The kernel also runs a few kernel threads of its own for background work such as writing dirty pages back to disk.</p>
<p>Its main jobs are the ones listed above: scheduling, memory management, device drivers, file systems, networking, and interprocess communication. Kernels differ in how much of that runs in privileged mode:</p>
<div class="tbl"><table>
<thead><tr><th>Design</th><th>What Runs in the Kernel</th><th>Examples</th><th>Trade-Off</th></tr></thead>
<tbody>
<tr><td>Monolithic</td><td>Everything: scheduler, memory manager, drivers, file systems, network stack, all in one address space</td><td>Linux, FreeBSD</td><td>Fast, since parts call each other directly, but a bug in any driver can crash or compromise the whole system. Loadable modules let parts be added at runtime.</td></tr>
<tr><td>Microkernel</td><td>Only the minimum: address spaces, threads, and message passing. Drivers and file systems run as user processes.</td><td>seL4, QNX, MINIX 3</td><td>A crashed driver can be restarted, and the small kernel can even be formally verified (seL4), but every service request costs messages and context switches.</td></tr>
<tr><td>Hybrid</td><td>A microkernel-style core with most services moved back into kernel mode for speed</td><td>Windows NT, macOS (XNU: Mach plus BSD)</td><td>Close to monolithic performance, with some of the microkernel's structure.</td></tr>
</tbody></table></div>
<p>For performance work, the kernel matters because it decides what runs, when, and with which memory. Every one of those decisions is made in code that user programs enter through a fault, a trap, or an interrupt, and every one shows up directly in performance: time spent in the kernel, pipeline flushes on entry and exit, and cache and TLB pollution after it returns.</p>

<h3 id="sec-shell">The Shell</h3>
<p>The <strong>shell</strong> is the program that takes commands from the user and asks the kernel to carry them out. The name comes from the picture of an outer layer wrapped around the kernel. Despite that, the shell is an ordinary user-mode process with no special privileges, so it can be swapped for another one: bash, zsh, fish, and dash on Unix, and PowerShell and cmd.exe on Windows. Graphical desktops such as Windows Explorer and GNOME Shell are shells in the same sense, since they also launch programs for the user.</p>
<p>A command-line shell runs a loop. For a command like <code>grep error log.txt &gt; errors.txt</code>:</p>
<ol>
<li><strong>Read:</strong> it prints a prompt and reads a line from the terminal.</li>
<li><strong>Parse:</strong> it splits the line into words, expands variables and wildcards, and notes the redirection.</li>
<li><strong>Find the program:</strong> if the command is a builtin, the shell runs it itself. Otherwise it searches the directories in <code>PATH</code> and finds <code>/usr/bin/grep</code>.</li>
<li><strong>Fork:</strong> it calls <code>fork</code> to create a child process.</li>
<li><strong>Set up and exec:</strong> the child opens <code>errors.txt</code>, moves it onto descriptor 1 (standard output) with <code>dup2</code>, and calls <code>execve</code> to replace itself with grep (see <a href="#/file-syscalls/sharing">Sharing Descriptors</a>).</li>
<li><strong>Wait:</strong> the parent calls <code>waitpid</code> until grep exits, stores its exit status in <code>$?</code>, and prints the next prompt.</li>
</ol>
<p>A pipeline such as <code>ls | wc -l</code> works the same way, except the shell first creates a pipe and forks two children, wiring the first one's standard output to the pipe's write end and the second one's standard input to its read end. Ending a command with <code>&amp;</code> skips the wait, which runs it in the background.</p>
<p>Some commands have to be builtins. <code>cd</code> changes the current directory, which belongs to each process, so if a child process ran it, only the child's directory would change and the shell's would stay the same. <code>exit</code> and <code>export</code> are builtins for the same reason.</p>
<p>The shell is also a programming language, with variables, conditionals, loops, and functions, so sequences of commands can be saved as scripts. It is separate from the <strong>terminal</strong>: the terminal emulator draws text and reads keys, the shell interprets commands, and a pseudo-terminal connects the two.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A process has a private anonymous heap page that it has already written. It calls <code>fork</code>, and the child stores to that page. Later, reclaim evicts the parent's copy of the page to swap, and then the parent loads from it. List the hardware and OS events in order, from the <code>fork</code> onward.</p>`,
        a: `<ol><li><strong>Fork:</strong> the kernel copies the parent's page table into the child, marks the page's entry read-only in both tables, and raises the frame's map count to 2. It flushes the parent's now-stale writable TLB entry.</li><li><strong>Child's store:</strong> the walk finds a present but read-only leaf entry, so the store is marked as faulting, and the core takes a page fault when it reaches the head of the ROB.</li><li><strong>Copy-on-write:</strong> the handler sees that the region is writable and the frame has 2 mappings, so it copies the page into a new frame and points the child's entry at the copy, writable. The store re-executes and completes.</li><li><strong>Eviction:</strong> the parent's frame reaches the tail of an inactive list with its accessed bit clear. Reclaim assigns a swap slot, replaces the parent's entry with a swap entry, shoots down the TLBs, writes the dirty page to swap, and frees the frame.</li><li><strong>Parent's load:</strong> the walk reaches the not-present leaf, and the fault is taken at commit. The handler reads the swap entry, reads the page back from swap (a major fault, unless the page is still in the swap cache), and maps it again. The load re-executes and completes.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why is a page fault a "fault" and a system call a "trap"? What does that change for the return address?</p>`,
        a: `<p>A fault is reported before the instruction completes, so the saved PC points at the faulting instruction and it is re-executed after the handler fixes the cause. A trap is reported after the instruction completes, so the saved PC points to the next instruction and execution continues past it.</p>`
      },
      {
        q: `<p>The shell is an ordinary user-mode process, not part of the kernel. What would be lost if a command interpreter were built into the kernel instead, and what would a shell running in the kernel still not be able to do without the same system calls it uses today?</p>`,
        a: `<ul><li><strong>Isolation:</strong> a bug in the parser or in a script would run with full privilege, so it could crash or compromise the whole machine instead of just one process.</li><li><strong>Choice:</strong> users pick bash, zsh, fish, or a graphical shell, and can run several at once with different settings. A built-in interpreter would fix one for everyone, and changing it would mean changing the kernel.</li><li><strong>A smaller trusted kernel:</strong> parsing, wildcard expansion, history, and scripting are large and change often, so keeping them out of privileged code keeps the kernel smaller and easier to get right.</li><li><strong>Nothing gained in power:</strong> starting a program still needs a new process with its own address space and descriptors, which is exactly what <code>fork</code>, <code>execve</code>, <code>dup2</code>, and <code>waitpid</code> already provide. The shell needs no privilege, only those calls, which is why it can be an ordinary program.</li></ul>`
      }
    ]
  }
}, [
{
  id: "exceptions",
  region: "os",
  title: "Faults, Traps, Interrupts, and System Calls",
  sections: [
    { id: "privilege-levels", label: "Privilege Levels" },
    { id: "out-order-core", label: "Making the Exception Precise" },
    { id: "hardware-sequence", label: "The Hardware Sequence" },
    { id: "vectors", label: "Vectors and the Interrupt Descriptor Table" },
    { id: "trap-frame", label: "The Handler and the Trap Frame" },
    { id: "return", label: "Returning to User Mode" },
    { id: "system-calls", label: "System Calls" },
    { id: "performance-trade-offs", label: "Performance Trade-Offs" },
    { id: "common-events", label: "Reference: Common Events" }
  ],
  body: `
<p>User code can't touch the page tables, the devices, or other processes. The only way into the kernel is for the core itself to transfer control there, to an address the kernel chose in advance. Four kinds of event do that. They differ in what causes them and where execution resumes. Main sources: Hennessy and Patterson (appendix C on exceptions in pipelines, and chapter 3 on reorder buffers), Bryant and O’Hallaron chapter 8, the RISC-V privileged specification, and the Intel SDM volume 3.</p>
<div class="tbl"><table>
<tr><th>Type</th><th>Cause</th><th>Timing</th><th>Resumes at</th><th>Examples</th></tr>
<tr><td>Fault</td><td>Instruction can't complete, but it's fixable</td><td>Synchronous, before completion</td><td>The faulting instruction (re-executed)</td><td>Page fault, protection fault</td></tr>
<tr><td>Trap</td><td>Intentional, or reported after completion</td><td>Synchronous, after completion</td><td>The next instruction</td><td>System call, breakpoint, single-step</td></tr>
<tr><td>Abort</td><td>Unrecoverable error</td><td>Synchronous or not</td><td>Usually doesn't resume</td><td>Machine check, double fault</td></tr>
<tr><td>Interrupt</td><td>External device or timer</td><td>Asynchronous</td><td>Between instructions</td><td>Timer, I/O completion, inter-processor interrupt</td></tr>
</table></div>

<h3 id="sec-privilege-levels">Privilege Levels</h3>
<p>The current privilege level is a few bits of core state: the low 2 bits of the CS register on x86, the EL field of PSTATE on ARM, and a mode register that software can't read directly on RISC-V. It decides two things:</p>
<ul>
<li><strong>Which instructions run:</strong> writing the page-table base (CR3, TTBR0_EL1, <code>satp</code>), masking interrupts, accessing devices, and returning from an exception all fault in user mode.</li>
<li><strong>Which pages are reachable:</strong> every page-table entry has a user/supervisor bit, so kernel memory can stay mapped in every address space and still fault on a user access (see <a href="#/virtual-memory/pages-page-tables">Pages and Page Tables</a>).</li>
</ul>
<p>x86 has rings 0–3 (kernel in 0, user in 3). ARM has exception levels EL0 (user), EL1 (kernel), EL2 (hypervisor), and EL3 (secure monitor). RISC-V has user, supervisor, and machine modes. No instruction raises privilege directly. Privilege goes up only through an exception entry, which always lands on a handler the kernel installed, and comes down only through an exception-return instruction.</p>

<h3 id="sec-out-order-core">Making the Exception Precise</h3>
<p>Hennessy and Patterson call an exception <strong>precise</strong> if the core stops so that every instruction before the faulting one has completed, and neither the faulting instruction nor anything after it has changed architectural state. The handler can then fix the cause and restart from one PC as if nothing had happened. An out-of-order core finishes instructions out of order, so it gets this property from the reorder buffer:</p>
<ol>
<li><strong>Detect:</strong> the unit that finds the problem writes an exception code into the instruction's ROB entry, plus the faulting address if there is one. That unit is decode for an illegal opcode, the TLB or page walker for a page fault, and the divider for a divide error. Nothing else happens yet.</li>
<li><strong>Wait:</strong> the instruction may be on a mispredicted path. If an older branch turns out to be mispredicted, the flush removes the faulting entry and the exception never happened. Meanwhile, younger instructions keep executing speculatively, which is the window Meltdown exploited.</li>
<li><strong>Take it at the head:</strong> when the entry reaches the ROB head, every older instruction has committed. The core flushes the ROB, the issue queues, and the load and store queues, and restores the rename map from the committed (retirement) map. Stores that already committed and sit in the store buffer still drain to memory, since they are architectural. Then the front end is redirected to the handler. How each structure is cleared and restored is in <a href="#/flush-recovery/exceptions">Pipeline Flush and Recovery</a>.</li>
</ol>
<p>Because exceptions are taken in commit order, the oldest one always wins, even if a younger instruction detected its fault first. An interrupt has no faulting instruction, so the core chooses a boundary: it flushes everything uncommitted and saves the PC of the oldest uncommitted instruction as the resume point. Flushing keeps interrupt latency short but throws away the work in flight, which in a 512-entry ROB (Intel's Golden Cove) can be hundreds of instructions that are fetched again after the handler. See <a href="#/rob">Reorder buffer</a>.</p>

<h3 id="sec-hardware-sequence">The Hardware Sequence</h3>
<p>Once the exception is taken, the core runs a fixed sequence with no software involved. RISC-V shows it most plainly. In an out-of-order core, all of it happens when the excepting instruction reaches the ROB head: the flush removes every younger instruction, the register writes below happen together, and the front end is redirected, so no instruction ever sees half of the change. No step writes memory, so the sequence itself can't fault. For an exception taken from user mode into supervisor mode:</p>
<ol>
<li><strong>Pick the target mode.</strong> By default every trap goes to machine mode. Machine-mode firmware (OpenSBI on Linux systems) sets bits in <code>medeleg</code> (one bit per exception code) and <code>mideleg</code> (one bit per interrupt) to hand chosen traps to supervisor mode instead. Linux has page faults, illegal instructions, breakpoints, and user <code>ecall</code>s delegated, so they reach the kernel directly and never pass through firmware. A delegated trap uses the <code>s</code>-prefixed registers below. An undelegated one runs the same steps with <code>mepc</code>, <code>mcause</code>, <code>mtval</code>, <code>mstatus</code>.MPP and MPIE, and <code>mtvec</code>.</li>
<li><strong>Save the resume PC.</strong> The virtual address of the instruction to resume at is written into <code>sepc</code>:
<ul>
<li><strong>Fault:</strong> the faulting instruction itself, so returning re-executes it.</li>
<li><strong>System call:</strong> the <code>ecall</code> itself, not the next instruction. The kernel adds 4 before returning.</li>
<li><strong>Interrupt:</strong> the oldest uncommitted instruction, which hasn't run yet.</li>
</ul></li>
<li><strong>Record the cause.</strong> <code>scause</code> gets two fields:
<ul>
<li><strong>The top bit (bit 63 on RV64):</strong> 1 for an interrupt, 0 for a synchronous exception.</li>
<li><strong>The exception code in the low bits:</strong> for exceptions, 2 for an illegal instruction, 8 for an <code>ecall</code> from user mode, and 12, 13, and 15 for instruction, load, and store page faults. For interrupts, 1 for a software interrupt (an IPI), 5 for the timer, and 9 for an external interrupt from the PLIC.</li>
</ul>
<code>stval</code> gets the detail the handler needs: the faulting virtual address for a page fault, access fault, or misaligned access, the instruction bits for an illegal instruction (or 0, which the spec allows), and 0 for an <code>ecall</code> or an interrupt.</li>
<li><strong>Save the old mode and interrupt state.</strong> Three bits of <code>sstatus</code> change:
<ul>
<li><strong>SPP</strong> takes the mode the trap came from: 0 for user, 1 for supervisor. This is the only record of where to return, because software can't read the mode itself.</li>
<li><strong>SPIE</strong> takes the old value of SIE.</li>
<li><strong>SIE</strong> is cleared. In supervisor mode, SIE gates every supervisor interrupt, so the handler starts with interrupts masked. It must copy <code>sepc</code>, <code>scause</code>, and <code>stval</code> to memory before setting SIE again, because a nested trap would overwrite them. In user mode SIE is ignored and supervisor interrupts always get through, which is how the timer preempts user code.</li>
</ul></li>
<li><strong>Raise privilege to supervisor mode.</strong> The core holds the current mode in a hidden 2-bit register (0 user, 1 supervisor, 3 machine), and this step writes 1 into it. Every privilege check in the pipeline reads that register, so from the first handler instruction onward four things change:
<ul>
<li><strong>Supervisor CSRs become accessible.</strong> Bits 9:8 of a CSR's 12-bit address give the lowest mode allowed to access it. <code>sstatus</code> (0x100), <code>sepc</code> (0x141), <code>satp</code> (0x180), and the other supervisor CSRs have 01 there, so <code>csrr</code> and <code>csrw</code> on them no longer raise an illegal instruction exception.</li>
<li><strong>Privileged instructions become legal:</strong> <code>sret</code>, <code>sfence.vma</code>, and <code>wfi</code>. Machine mode can still make <code>sret</code> and <code>wfi</code> trap through <code>mstatus</code>.TSR and TW, which a hypervisor uses.</li>
<li><strong>The page permission check flips.</strong> The page table doesn't change, since <code>satp</code> still points at the same root, but the U bit of each PTE is now read the other way. Pages with U = 0, the kernel's, become accessible. Pages with U = 1, the user's, now fault on a load or store unless <code>sstatus</code>.SUM is set, and always fault on an instruction fetch. Linux keeps SUM clear except inside <code>copy_from_user</code> and <code>copy_to_user</code>, so a stray kernel dereference of a user pointer faults instead of reading whatever the user put there.</li>
<li><strong>Interrupt gating changes:</strong> supervisor interrupts are now taken only while SIE is 1, and the previous step just cleared it.</li>
</ul></li>
<li><strong>Jump to the handler.</strong> <code>stvec</code>, which the kernel wrote at boot, holds a 4-byte-aligned BASE plus a 2-bit MODE in its low bits. The PC is set to:
<ul>
<li><strong>Direct mode (0):</strong> BASE, for every trap. Linux uses this, with BASE pointing at <code>handle_exception</code>, which dispatches on <code>scause</code> in software.</li>
<li><strong>Vectored mode (1):</strong> BASE for synchronous exceptions, and BASE + 4 × the cause code for interrupts, so a timer interrupt (code 5) lands at BASE + 20.</li>
</ul>
Fetch restarts at that address in supervisor mode, translated through the same page table. The handler sits on a kernel page (U = 0, X = 1), so this fetch passes a check that the same fetch from user mode would fail.</li>
</ol>
<p>For example, a user program on an RV64 Linux system with Sv39 paging loads from a heap page it has never touched, so no PTE exists yet. The load is <code>ld a0, 8(a1)</code> at PC 0x1_0a3c, with a1 = 0x15_5556_1000. When the load reaches the ROB head, the core flushes and changes this state:</p>
<div class="tbl"><table>
<tr><th>State</th><th>Before (user code running)</th><th>After (first handler instruction)</th></tr>
<tr><td>Mode</td><td>User (0)</td><td>Supervisor (1)</td></tr>
<tr><td>PC</td><td>0x1_0a3c</td><td>0xffff_ffff_8000_3a40 (<code>handle_exception</code>, from <code>stvec</code>)</td></tr>
<tr><td><code>sepc</code></td><td>Left over from the last trap</td><td>0x1_0a3c</td></tr>
<tr><td><code>scause</code></td><td>Left over from the last trap</td><td>13 (bit 63 is 0: a load page fault)</td></tr>
<tr><td><code>stval</code></td><td>Left over from the last trap</td><td>0x15_5556_1008</td></tr>
<tr><td><code>sstatus</code> SPP, SPIE, SIE</td><td>0, 1, 1 (the last <code>sret</code> set them)</td><td>0, 1, 0</td></tr>
<tr><td>a0, a1, sp, and the other general registers</td><td>User values</td><td>Unchanged</td></tr>
<tr><td><code>satp</code></td><td>This process's page table</td><td>Unchanged</td></tr>
</table></div>
<p>The last two rows matter most: RISC-V saves no general registers and doesn't switch stacks, so the handler starts with the user's sp and has to find a kernel stack before it can save anything (see <a href="#/exceptions/trap-frame">The Handler and the Trap Frame</a>). x86 and ARM do some of that in hardware:</p>
<div class="tbl"><table>
<tr><th>Step</th><th>x86-64 (interrupt or exception from ring 3)</th><th>ARMv8-A (EL0 to EL1)</th><th>RISC-V (user to supervisor)</th></tr>
<tr><td>Resume PC</td><td>Pushed on the kernel stack (RIP)</td><td>ELR_EL1</td><td><code>sepc</code></td></tr>
<tr><td>Cause</td><td>The vector number selects the IDT entry, some vectors push an error code, and CR2 holds a page fault's address</td><td>ESR_EL1 (exception class and syndrome), FAR_EL1 for the address</td><td><code>scause</code>, <code>stval</code></td></tr>
<tr><td>Old state</td><td>RFLAGS, CS, SS, and RSP pushed, and an interrupt gate clears IF</td><td>SPSR_EL1 takes PSTATE, and the DAIF masks are set</td><td><code>sstatus</code> SPP and SPIE, SIE cleared</td></tr>
<tr><td>Stack</td><td>Loads RSP from the TSS (RSP0, or an IST entry for faults that need a known-good stack)</td><td>Switches to the banked SP_EL1</td><td>None. The handler finds its own.</td></tr>
<tr><td>Handler address</td><td>The IDT entry for the vector</td><td>VBAR_EL1 plus an offset for the source level and type (0x400 for a synchronous exception from AArch64 EL0)</td><td><code>stvec</code></td></tr>
<tr><td>Return instruction</td><td><code>iretq</code>, or <code>sysretq</code> after <code>syscall</code></td><td><code>eret</code></td><td><code>sret</code></td></tr>
</table></div>

<h3 id="sec-vectors">Vectors and the Interrupt Descriptor Table</h3>
<p>On x86-64, every event that enters the kernel through the IDT carries a <strong>vector</strong>: an 8-bit number, 0 to 255, that says which event it is. The vector does two jobs at once. It identifies the event, and it selects the handler, so the kernel never has to work out after the fact what happened. The range is split in two (Intel SDM volume 3, chapter 6):</p>
<ul>
<li><strong>0 to 31, fixed by the architecture:</strong> the CPU's own exceptions, plus the NMI (vector 2). Each has a short name: #DE (0, divide error), #UD (6, invalid opcode), #GP (13, general protection), #PF (14, page fault), and so on. The core raises these itself, with the vector built in.</li>
<li><strong>32 to 255, assigned by the OS:</strong> device interrupts, the local APIC timer, and inter-processor interrupts. The kernel picks a free vector and programs it into whatever raises the interrupt: an I/O APIC redirection entry, a device's MSI message, the timer's register, or the command register used to send an IPI. Software can also raise any vector with <code>int n</code>, which is how the old <code>int 0x80</code> system call worked.</li>
</ul>
<p>The <strong>Interrupt Descriptor Table</strong> (IDT) is an array in kernel memory with one 16-byte entry, called a <strong>gate</strong>, per vector. At boot, the kernel fills it in and loads its base address and size into the IDTR register with <code>lidt</code>, a privileged instruction. Each gate holds:</p>
<ul>
<li><strong>The handler address</strong> and the kernel code segment to run it in.</li>
<li><strong>The gate type:</strong> an interrupt gate clears IF, so the handler starts with maskable interrupts off, and a trap gate leaves IF alone. Linux uses interrupt gates for all of them.</li>
<li><strong>A descriptor privilege level (DPL):</strong> the least privileged code allowed to raise this vector with <code>int n</code>. Linux gives vector 3 a DPL of 3 so a debugger's <code>int3</code> works from user mode, and gives most other vectors a DPL of 0, so a user program that runs <code>int 14</code> gets a #GP rather than a fake page fault. Hardware-raised events skip this check.</li>
<li><strong>An IST index:</strong> 0 means "use the normal kernel stack". 1 to 7 picks one of the seven Interrupt Stack Table stacks in the TSS, which Linux uses for events that can arrive when the current stack is unusable: the double fault, the NMI, the machine check, and the debug exception.</li>
<li><strong>A present bit:</strong> a vector with no handler installed raises #NP (11) instead.</li>
</ul>
<p>When an event with vector \\(v\\) is taken, the core:</p>
<ol>
<li><strong>Reads the gate</strong> at IDTR.base + 16 × \\(v\\). For a page fault, that is the entry at offset 16 × 14 = 224 bytes.</li>
<li><strong>Checks</strong> that it is present, and, for <code>int n</code>, that the DPL allows the current privilege level.</li>
<li><strong>Switches stacks</strong> if it is coming from ring 3, loading RSP from the TSS (RSP0, or the IST entry the gate names).</li>
<li><strong>Pushes the interrupted state:</strong> SS, RSP, RFLAGS, CS, and RIP. For some vectors (8, 10 to 14, 17, and 21 among them) it also pushes an <strong>error code</strong>. A page fault's error code says whether the page was present, whether the access was a write, whether it came from user mode, and whether it was an instruction fetch. The faulting address goes in CR2.</li>
<li><strong>Jumps</strong> to the gate's handler, clearing IF for an interrupt gate.</li>
</ol>
<p>Because every vector has its own handler, Linux's IDT entries point at small assembly stubs, one per vector, that build the trap frame and call the matching C function (see <a href="#/exceptions/trap-frame">The Handler and the Trap Frame</a>). Device interrupts share one common path, which looks up the vector in a per-CPU table to find the driver's handler. The local APIC also uses the vector as a priority: its upper 4 bits form the priority class, and an interrupt is delivered only if its class is above the one the core is currently handling and above the task priority register (TPR).</p>
<p>The other ISAs do the same job differently:</p>
<ul>
<li><strong>RISC-V:</strong> no table. Every exception and interrupt jumps to the one address in <code>stvec</code>, and the handler reads <code>scause</code> to dispatch in software. Vectored mode only spreads interrupts across slots.</li>
<li><strong>ARMv8-A:</strong> a fixed table at VBAR_EL1 with 16 slots of 0x80 bytes, one for each pair of source (current level or lower level, AArch64 or AArch32) and type (synchronous, IRQ, FIQ, SError). The handler reads ESR_EL1 for the exception class, and for an IRQ it reads the interrupt number from the GIC.</li>
<li><strong>FRED on newer Intel cores:</strong> Flexible Return and Event Delivery replaces IDT-based delivery with two fixed entry points (events from ring 3 and events from ring 0). The event type and vector are saved in the stack frame for software to dispatch on, and new <code>eretu</code> and <code>erets</code> instructions replace <code>iretq</code>. Linux has supported it since version 6.9.</li>
</ul>
<p>System calls through <code>syscall</code> don't use a vector at all: the instruction jumps to the address in the LSTAR register (see <a href="#/exceptions/system-calls">System Calls</a>). The full list of common vectors is in <a href="#/exceptions/common-events">Reference: Common Events</a>.</p>

<h3 id="sec-trap-frame">The Handler and the Trap Frame</h3>
<p>The hardware saves only what it must to reach the handler. The kernel's entry code, written in assembly, saves everything else before any C code runs:</p>
<ol>
<li><strong>Get a trustworthy stack.</strong> The user stack pointer can't be used: it may be unmapped, point into kernel memory, or be changed by another user thread mid-call. On RISC-V, the entry code swaps a register with <code>sscratch</code>, which the kernel loaded with a pointer to the current thread's kernel data, and finds the kernel stack from there. On x86-64, <code>syscall</code> doesn't switch stacks, so the entry code runs <code>swapgs</code> to reach per-CPU data, saves the user RSP there, and loads the kernel stack pointer.</li>
<li><strong>Build the trap frame.</strong> Push all general registers, plus the saved PC, status, and cause, onto the kernel stack. This <strong>trap frame</strong> (<code>struct pt_regs</code> on Linux) is the user thread's complete register state.</li>
<li><strong>Dispatch</strong> to the C handler for the cause: the page-fault handler, the system-call table, or a device's interrupt handler.</li>
</ol>
<p>The trap frame is what the rest of the kernel works on. A system call returns its result by writing the saved <code>rax</code> or <code>a0</code>. A context switch is the kernel returning through a different thread's trap frame. A signal is delivered by editing the saved PC (see <a href="#/process-syscalls/signals">Signals</a>).</p>

<h3 id="sec-return">Returning to User Mode</h3>
<ol>
<li><strong>Choose where to go.</strong> Usually back to the same thread. If the scheduler picked another thread, the kernel switches to that thread's kernel stack and returns through its trap frame instead. If a signal is pending, it edits the trap frame first.</li>
<li><strong>Switch page tables if needed.</strong> With kernel page-table isolation (KPTI, for Meltdown-affected x86 cores), CR3 goes back to the user page table.</li>
<li><strong>Restore the general registers</strong> from the trap frame.</li>
<li><strong>Execute the return instruction.</strong> <code>sret</code> sets the PC to <code>sepc</code>, the privilege to SPP, and SIE to SPIE in one step, so user code never runs with kernel privilege and the kernel never runs at a user PC.</li>
</ol>
<p>The saved PC is what makes a fault different from a trap. A fault leaves it at the faulting instruction, so returning re-executes it. RISC-V also leaves <code>sepc</code> at the <code>ecall</code>, so the kernel adds 4 before returning, or the system call would repeat forever. x86 <code>syscall</code> and ARM <code>svc</code> save the address of the next instruction instead.</p>

<h3 id="sec-system-calls">System Calls</h3>
<p>A system call is a trap the program asks for. The C function <code>read</code> is a short libc wrapper: it puts the call number and arguments in registers and executes the trap instruction.</p>
<div class="tbl"><table>
<tr><th></th><th>x86-64 Linux</th><th>AArch64 Linux</th><th>RISC-V Linux</th></tr>
<tr><td>Trap instruction</td><td><code>syscall</code></td><td><code>svc #0</code></td><td><code>ecall</code></td></tr>
<tr><td>Call number</td><td>rax</td><td>x8</td><td>a7</td></tr>
<tr><td>Arguments</td><td>rdi, rsi, rdx, r10, r8, r9</td><td>x0–x5</td><td>a0–a5</td></tr>
<tr><td>Result</td><td>rax</td><td>x0</td><td>a0</td></tr>
</table></div>
<p>x86 passes the fourth argument in r10 instead of the usual rcx because <code>syscall</code> itself overwrites rcx with the return address and r11 with RFLAGS. A result from −4095 to −1 is an error code, which the wrapper turns into a return value of −1 plus <code>errno</code>.</p>
<p><code>syscall</code> is faster than going through an interrupt vector (the old <code>int 0x80</code>): it reads the handler address from the LSTAR register instead of the IDT in memory, pushes nothing, and skips the segment-descriptor checks. The entry code builds the trap frame, indexes the system-call table by the call number, and calls the handler.</p>
<p>Some calls skip the kernel entirely. The kernel maps a small shared library, the <strong>vDSO</strong>, into every process, along with a read-only data page that it keeps updated. <code>clock_gettime</code> reads the time from that page and the timestamp counter in user mode, in tens of nanoseconds instead of a kernel entry. The calls programs make most often are covered in <a href="#/file-syscalls">File System Calls</a>, <a href="#/process-syscalls">Process System Calls</a>, and <a href="#/mmap">Memory Mapping</a>.</p>

<h3 id="sec-performance-trade-offs">Performance Trade-Offs</h3>
<ul>
<li><strong>Direct cost:</strong> a null system call such as <code>getppid</code> takes on the order of 100 ns on a recent core. Mitigations for speculative-execution attacks (KPTI's page-table switch, predictor barriers) can multiply that.</li>
<li><strong>Indirect cost:</strong> each crossing flushes the pipeline, and the kernel's code and data displace user state in the L1 caches, branch predictors, and TLBs. Soares and Stumm (FlexSC, OSDI 2010) found that user-mode IPC stays depressed for thousands of cycles after a system call, so the indirect cost can exceed the direct one.</li>
<li><strong>Batching:</strong> <code>io_uring</code> passes requests and completions through rings shared with the kernel, so one system call, or none with kernel-side polling, covers many operations.</li>
<li><strong>Interrupts:</strong> interrupt coalescing and polling trade latency for throughput in I/O-heavy servers.</li>
<li><strong>For a simulator:</strong> syscall-emulation mode (gem5 SE) carries out each call in the simulator, so neither the kernel's instructions nor its pollution of caches and predictors appears. Workloads that cross often need full-system simulation.</li>
</ul>

<h3 id="sec-common-events">Reference: Common Events</h3>
<p>The events a kernel handles most often, split into hardware events and system calls. A dash in the last column means no subsection covers the event yet.</p>
<h4 id="sec-hardware-events">Hardware Events</h4>
<p>The x86-64 column gives the event's vector, the number that picks its entry in the IDT (see <a href="#/exceptions/vectors">Vectors and the Interrupt Descriptor Table</a>). The RISC-V column gives the <code>scause</code> code. For interrupts, the RISC-V code is the one with the interrupt bit set.</p>
<div class="tbl"><table>
<tr><th>Event</th><th>Kind</th><th>x86-64 vector</th><th>RISC-V <code>scause</code></th><th>What usually happens</th><th>Described in</th></tr>
<tr><td>Page fault, page not present</td><td>Fault</td><td>14 (#PF)</td><td>12, 13, 15 (fetch, load, store)</td><td>The kernel maps a zeroed page or reads it from a file or swap (a minor or major fault), and the instruction re-executes</td><td><a href="#/exceptions/out-order-core">Making the Exception Precise</a>, <a href="#/demand-paging/first-touch">Filling the Path on a First Touch</a>, <a href="#/page-replacement/eviction">Evicting Pages</a></td></tr>
<tr><td>Copy-on-write fault</td><td>Fault</td><td>14 (#PF)</td><td>15</td><td>A store to a shared read-only page gets a private copy, and the store re-executes</td><td><a href="#/demand-paging/cow">Copy-on-Write After Fork</a></td></tr>
<tr><td>Protection violation (segmentation fault)</td><td>Fault</td><td>14 (#PF)</td><td>12, 13, 15, or 1, 5, 7 for a PMP access fault</td><td>An address in no region, or an access the region forbids, becomes <code>SIGSEGV</code></td><td><a href="#/virtual-memory/pages-page-tables">Pages and Page Tables</a>, <a href="#/process-syscalls/signals">Signals</a></td></tr>
<tr><td>Instruction fetch fault</td><td>Fault</td><td>14 (#PF)</td><td>12, or 1 for an access fault</td><td>Taken only if the faulting fetch reaches commit, then handled like any page fault</td><td><a href="#/stage-if/exceptions">Exceptions in Fetch</a></td></tr>
<tr><td>General protection fault</td><td>Fault</td><td>13 (#GP)</td><td>2 (a privileged instruction in user mode is illegal)</td><td>A privileged instruction in user mode, or a non-canonical address, becomes <code>SIGSEGV</code></td><td><a href="#/exceptions/privilege-levels">Privilege Levels</a></td></tr>
<tr><td>Invalid opcode</td><td>Fault</td><td>6 (#UD)</td><td>2</td><td>Decode flags it, and it becomes <code>SIGILL</code> (or the kernel emulates the instruction)</td><td><a href="#/exceptions/out-order-core">Making the Exception Precise</a>, <a href="#/process-syscalls/signals">Signals</a></td></tr>
<tr><td>Integer divide by zero</td><td>Fault</td><td>0 (#DE)</td><td>None. RISC-V division by zero returns all ones and doesn't trap.</td><td><code>SIGFPE</code></td><td><a href="#/exceptions/out-order-core">Making the Exception Precise</a>, <a href="#/process-syscalls/signals">Signals</a></td></tr>
<tr><td>Floating-point exception</td><td>Fault, only when unmasked</td><td>19 (#XM, SSE and AVX), 16 (#MF, x87)</td><td>None. RISC-V only sets the <code>fflags</code> bits.</td><td>Masked by default, so it only sets sticky flags. Unmasked, it becomes <code>SIGFPE</code>.</td><td><a href="#/fp-rounding/exceptions">The Five Exceptions</a></td></tr>
<tr><td>Misaligned access</td><td>Fault</td><td>17 (#AC, only with the AC flag set)</td><td>0, 4, 6 (fetch, load, store)</td><td>Usually handled in hardware or emulated by firmware or the kernel, otherwise <code>SIGBUS</code></td><td><a href="#/stage-if/exceptions">Exceptions in Fetch</a> (fetch only)</td></tr>
<tr><td>Device not available</td><td>Fault</td><td>7 (#NM)</td><td>2 (FP instruction while <code>sstatus</code>.FS is Off)</td><td>Lazy FPU switching: the kernel restores the thread's FP registers and re-executes</td><td>—</td></tr>
<tr><td>Guest page fault (EPT or G-stage violation)</td><td>Fault, taken by the hypervisor</td><td>A VM exit, not an IDT vector</td><td>20, 21, 23 (fetch, load, store)</td><td>The hypervisor maps the guest-physical page and resumes the guest</td><td><a href="#/virtualization/nested-walks">Two-Dimensional Page Walks</a></td></tr>
<tr><td>System call</td><td>Trap</td><td>None. <code>syscall</code> jumps through LSTAR, not the IDT.</td><td>8 (<code>ecall</code> from user mode)</td><td>The kernel runs the call and resumes after the trap instruction</td><td><a href="#/exceptions/system-calls">System Calls</a>, <a href="#/exceptions/return">Returning to User Mode</a></td></tr>
<tr><td>Breakpoint</td><td>Trap</td><td>3 (#BP, <code>int3</code>)</td><td>3 (<code>ebreak</code>)</td><td><code>SIGTRAP</code> to a debugger</td><td>—</td></tr>
<tr><td>Single-step and watchpoint</td><td>Trap</td><td>1 (#DB)</td><td>None. Handled by the debug specification's trigger module.</td><td><code>SIGTRAP</code> to a debugger</td><td>—</td></tr>
<tr><td>Double fault</td><td>Abort</td><td>8 (#DF)</td><td>16 (double trap, Ssdbltrp, taken in machine mode)</td><td>An exception while delivering another one. The kernel reports it and panics.</td><td>—</td></tr>
<tr><td>Machine check</td><td>Abort</td><td>18 (#MC)</td><td>19 (hardware error)</td><td>An uncorrectable hardware error, such as a multi-bit ECC error. The kernel kills the affected process or panics.</td><td>—</td></tr>
<tr><td>Timer interrupt</td><td>Interrupt</td><td>Local APIC timer, a vector the OS assigns (32–255)</td><td>5 (supervisor timer)</td><td>The scheduler tick: account time and maybe switch threads</td><td><a href="#/exceptions/out-order-core">Making the Exception Precise</a> (how any interrupt is taken)</td></tr>
<tr><td>Device interrupt</td><td>Interrupt</td><td>A vector from 32–255, through the I/O APIC or an MSI</td><td>9 (supervisor external, through the PLIC or AIA)</td><td>The driver's handler acknowledges the device and queues the rest of the work</td><td><a href="#/exceptions/out-order-core">Making the Exception Precise</a></td></tr>
<tr><td>Inter-processor interrupt (TLB shootdown, reschedule)</td><td>Interrupt</td><td>A vector the OS assigns, sent through the local APIC</td><td>1 (supervisor software), or 9 through the AIA's IMSIC</td><td>The target core flushes TLB entries or reschedules, then acknowledges</td><td><a href="#/tlb/coherence">Keeping TLBs Coherent</a>, <a href="#/mmap/change">Changing and Removing Mappings</a></td></tr>
<tr><td>Non-maskable interrupt</td><td>Interrupt</td><td>2 (NMI)</td><td>None standard. The Smrnmi extension adds resumable NMIs in machine mode.</td><td>Watchdogs and hardware errors, taken even with interrupts masked</td><td>—</td></tr>
<tr><td>Performance-counter overflow</td><td>Interrupt</td><td>The local APIC's PMI entry, usually set to deliver an NMI on Linux</td><td>13 (counter overflow, Sscofpmf)</td><td>A sampling profiler such as <code>perf record</code> logs the PC</td><td>—</td></tr>
</table></div>
<h4 id="sec-syscall-numbers">System Call Numbers</h4>
<p>A system call is identified by a number the program puts in a register before the trap instruction: <code>rax</code> on x86-64, <code>a7</code> on RISC-V, and <code>x8</code> on AArch64. The numbers below are Linux's. AArch64 Linux uses the same numbers as RISC-V, since both follow the kernel's generic table.</p>
<div class="tbl"><table>
<tr><th>Call</th><th>x86-64 number</th><th>RISC-V and AArch64 number</th><th>What it does</th><th>Described in</th></tr>
<tr><td><code>read</code>, <code>write</code></td><td>0, 1</td><td>63, 64</td><td>Copy bytes between a descriptor and a buffer</td><td><a href="#/file-syscalls/read-write">Reading and Writing</a></td></tr>
<tr><td><code>openat</code>, <code>close</code></td><td>257, 3 (and <code>open</code>, 2)</td><td>56, 57</td><td>Create and release a file descriptor</td><td><a href="#/file-syscalls/open-close">Opening and Closing Files</a></td></tr>
<tr><td><code>lseek</code></td><td>8</td><td>62</td><td>Move a descriptor's offset</td><td><a href="#/file-syscalls/read-write">Reading and Writing</a></td></tr>
<tr><td><code>fstat</code>, <code>stat</code></td><td>5, 4</td><td>80, 79 (<code>newfstatat</code>)</td><td>Read an inode's size, mode, and timestamps</td><td><a href="#/file-syscalls/durability">Metadata and Durability</a></td></tr>
<tr><td><code>fsync</code></td><td>74</td><td>82</td><td>Wait until a file's data is on storage</td><td><a href="#/file-syscalls/durability">Metadata and Durability</a></td></tr>
<tr><td><code>rename</code>, <code>unlink</code></td><td>82, 87</td><td>276 (<code>renameat2</code>), 35 (<code>unlinkat</code>)</td><td>Replace or remove a name</td><td><a href="#/file-syscalls/durability">Metadata and Durability</a></td></tr>
<tr><td><code>pipe</code>, <code>dup2</code></td><td>22, 33</td><td>59 (<code>pipe2</code>), 24 (<code>dup3</code>)</td><td>Create a pipe, and point one descriptor at another's open file</td><td><a href="#/file-syscalls/sharing">Sharing Descriptors: fork, dup2, and pipe</a></td></tr>
<tr><td><code>mmap</code></td><td>9</td><td>222</td><td>Create a region backed by a file or anonymous memory</td><td><a href="#/mmap/mmap">Mapping a File with mmap</a></td></tr>
<tr><td><code>munmap</code>, <code>mprotect</code>, <code>madvise</code>, <code>msync</code></td><td>11, 10, 28, 26</td><td>215, 226, 233, 227</td><td>Remove a region, change its permissions, give paging hints, or write back a shared mapping</td><td><a href="#/mmap/change">Changing and Removing Mappings</a></td></tr>
<tr><td><code>brk</code></td><td>12</td><td>214</td><td>Move the end of the heap</td><td><a href="#/mmap/malloc">Where malloc Gets Its Memory</a></td></tr>
<tr><td><code>fork</code>, <code>clone</code></td><td>57, 56</td><td>None (glibc's <code>fork</code> calls <code>clone</code>), 220</td><td>Create a process or a thread</td><td><a href="#/process-syscalls/fork">Creating a Process with fork</a>, <a href="#/process-syscalls/lifecycle">The Life of a Process</a></td></tr>
<tr><td><code>execve</code></td><td>59</td><td>221</td><td>Replace the program in the calling process</td><td><a href="#/process-syscalls/spawn">Starting a New Program: Exec and Spawn</a></td></tr>
<tr><td><code>exit_group</code>, <code>wait4</code></td><td>231, 61</td><td>94, 260</td><td>End a process, and reap a child's exit status</td><td><a href="#/process-syscalls/exit-wait">Exiting and Waiting</a></td></tr>
<tr><td><code>kill</code>, <code>rt_sigaction</code>, <code>rt_sigreturn</code></td><td>62, 13, 15</td><td>129, 134, 139</td><td>Send a signal, install a handler, and return from one</td><td><a href="#/process-syscalls/signals">Signals</a>, <a href="#/process-syscalls/lifecycle">The Life of a Process</a></td></tr>
<tr><td><code>getpid</code>, <code>getppid</code></td><td>39, 110</td><td>172, 173</td><td>Return the caller's and its parent's PID. The usual null call for timing kernel entry.</td><td><a href="#/process-syscalls/lifecycle">The Life of a Process</a>, <a href="#/exceptions/performance-trade-offs">Performance Trade-Offs</a></td></tr>
<tr><td><code>nanosleep</code>, <code>sched_yield</code></td><td>35, 24</td><td>101, 124</td><td>Block for a time, or give up the core</td><td><a href="#/process-syscalls/lifecycle">The Life of a Process</a></td></tr>
<tr><td><code>clock_gettime</code></td><td>228</td><td>113</td><td>Read the time, normally through the vDSO without entering the kernel</td><td><a href="#/exceptions/system-calls">System Calls</a></td></tr>
<tr><td><code>epoll_wait</code></td><td>232</td><td>22 (<code>epoll_pwait</code>)</td><td>Wait until any of many descriptors is ready</td><td><a href="#/process-syscalls/perf">Performance Trade-Offs</a> (in passing)</td></tr>
<tr><td><code>io_uring_enter</code></td><td>426</td><td>426</td><td>Submit and reap a batch of I/O through shared rings</td><td><a href="#/exceptions/performance-trade-offs">Performance Trade-Offs</a></td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A server makes 1 million system calls per second per core, each costing 500 ns of entry, dispatch, and exit overhead. What fraction of the core goes to overhead, and what would you do?</p>`,
        a: `<ol><li>Overhead per second = 10<sup>6</sup> × 500 ns = 0.5 s.</li><li>That's <strong>50%</strong> of the core.</li><li>Reduce the count: batch work per call (<code>io_uring</code>, <code>sendmmsg</code>), use vDSO for calls like <code>clock_gettime</code> that need no kernel entry, or bypass the kernel for I/O.</li></ol>`
      },
      {
        q: `<p>On RISC-V Linux, a user program executes <code>ecall</code> at address 0x10a4c with a7 = 63 (<code>read</code>) and interrupts enabled. Give <code>sepc</code>, <code>scause</code>, SPP, and SIE right after the trap, the PC the program resumes at, and what happens if the kernel forgets to adjust <code>sepc</code>.</p>`,
        a: `<ol><li><code>sepc</code> = <strong>0x10a4c</strong>, the address of the <code>ecall</code> itself.</li><li><code>scause</code> = <strong>8</strong>, environment call from user mode, with the interrupt bit clear.</li><li>SPP = <strong>0</strong> (the trap came from user mode). SPIE takes the old SIE value, 1, and SIE = <strong>0</strong>.</li><li>The PC jumps to <code>stvec</code>. The entry code builds the trap frame, the dispatcher calls the <code>read</code> handler (number 63), and the result goes into the saved a0.</li><li>Before <code>sret</code>, the kernel sets <code>sepc</code> = 0x10a4c + 4 = <strong>0x10a50</strong>, so the program resumes after the <code>ecall</code>.</li><li>Without that adjustment, <code>sret</code> returns to the <code>ecall</code>, which traps again with the same a7 (and the result in a0 as the new first argument), so the program never gets past it.</li></ol>`
      },
      {
        q: `<p>Linux on x86-64 maps its IDT read-only at virtual address 0xfffffe0000000000 and assigns the local APIC timer to vector 0xec. The task priority register is 0. The timer fires while a user thread is running.</p><ol><li>From which address does the core read the timer's gate?</li><li>Does the core push an error code, and which stack does it switch to?</li><li>Suppose instead that the core is in the middle of handling a reschedule IPI (vector 0xfd) when the timer fires. Is the timer delivered right away?</li></ol>`,
        a: `<ol><li>Each gate is 16 bytes, so the offset is 16 × 0xec = 0xec0, and the gate is at 0xfffffe0000000000 + 0xec0 = <strong>0xfffffe0000000ec0</strong>.</li><li><strong>No error code:</strong> only some of the architecture's exception vectors (0 to 31) push one, and an external interrupt never does. The thread was in ring 3, so the core switches stacks. The timer's gate has an IST index of 0, so it loads <strong>RSP0 from the TSS</strong>, the current thread's kernel stack, then pushes SS, RSP, RFLAGS, CS, and RIP.</li><li><strong>No.</strong> The priority class is the vector's upper 4 bits: 0xe for the timer and 0xf for the reschedule IPI. The local APIC holds an interrupt until its class is above the class in service, so the timer waits in the IRR until the IPI handler writes EOI. The interrupt gate already cleared IF as well, so even a higher class would wait until the handler re-enables interrupts.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Walk through what an out-of-order core does when a load page-faults.</p>`,
        a: `<ol><li>The load misses the TLB, and the walker finds a non-present entry. The load is marked faulting in its ROB entry; nothing architectural happens yet.</li><li>If an older branch was mispredicted, the load is squashed and the fault disappears.</li><li>When the load reaches the ROB head, the core flushes it and everything younger, saves the faulting PC and address (CR2 on x86, FAR on ARM), switches to kernel mode, and jumps to the fault vector.</li><li>The handler maps the page and returns; the load re-executes from the saved PC.</li></ol>`
      },
      {
        q: `<p>Why did system calls get more expensive after Meltdown?</p>`,
        a: `<p>Meltdown let user code speculatively read kernel memory mapped in the same address space. The fix, kernel page-table isolation, gives the kernel a separate page table, so every system call and interrupt switches page tables (and without PCIDs, flushes the TLB). That adds hundreds of cycles to each entry and exit; newer cores fix the hardware flaw so the isolation can be dropped.</p>`
      },
      {
        q: `<p>In an x86-64 out-of-order core, a load page-faults and records the fault in its ROB entry. Twenty cycles later, an older integer divide in the same thread finds a zero divisor and records a divide error. No branch between them is mispredicted. Which exception does the kernel see first, and what happens to the other one?</p>`,
        a: `<p>The kernel sees the divide error first. Exceptions are taken only when the instruction reaches the ROB head, in program order, and the divide is older, so it reaches the head first no matter when each fault was detected. Taking it flushes everything younger, including the faulting load, and its recorded page fault is discarded with it. If the handler resumes the program (for example, a SIGFPE handler that skips the divide), the load is fetched and executed again, and only then does it raise its page fault again. If the divide error kills the process, the page fault is never taken at all.</p>`
      },
      {
        q: `<p>Linux points the x86-64 double-fault gate (vector 8) at an IST stack instead of letting it use the normal kernel stack. Why, and what would happen without it? Assume the double fault is raised while the core is already in ring 0.</p>`,
        a: `<ul><li><strong>The usual cause is a broken stack.</strong> A kernel stack overflow runs RSP into the unmapped guard page below the stack. The next push takes a page fault, and delivering that page fault means pushing onto the same unmapped stack, which faults again. A fault while delivering a page fault becomes a double fault.</li><li><strong>Ring 0 to ring 0 doesn't switch stacks.</strong> Without an IST entry, the core would push the double fault's frame onto the same bad RSP. That push faults too, and a fault while delivering a double fault is a <strong>triple fault</strong>: the core shuts down and the machine resets with no message.</li><li><strong>An IST index forces a switch</strong> to a known-good, per-CPU stack regardless of privilege level. The handler gets a valid stack, prints the "kernel stack overflow" oops with a backtrace, and panics cleanly. NMIs and machine checks use IST stacks for the same reason, since they can arrive at any instruction, including the few in the entry code before the kernel stack is set up.</li></ul>`
      },
      {
        q: `<p>On x86-64, <code>syscall</code> doesn't switch stacks. Why can't the kernel just keep running on the user's stack for the call?</p>`,
        a: `<ul><li><strong>It may not be valid.</strong> User code can set RSP to anything. If it points at an unmapped page, the kernel's first push faults inside the kernel entry path, before any state is saved.</li><li><strong>It may point at kernel memory.</strong> The kernel's pushes would then overwrite its own data, a direct privilege escalation.</li><li><strong>Other threads can change it.</strong> Another user thread sharing the address space can rewrite that stack while the kernel uses it, corrupting saved state or return addresses.</li><li><strong>It would leak data.</strong> Kernel values left on a user-readable stack would be visible to user code afterward.</li></ul><p>So the entry code saves the user RSP and loads a per-thread kernel stack, reached through <code>swapgs</code> and per-CPU data, before it pushes anything. Interrupts and exceptions get the same protection in hardware from the TSS stack switch.</p>`
      }
    ]
  }
},

{
  id: "context-switch",
  region: "os",
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
<li><strong>Switch the rest</strong> (<code>__switch_to</code>): the FS and GS bases, the kernel stack pointer the CPU uses on the next kernel entry, and the FPU state. Linux saves the old thread's vector registers with <code>XSAVES</code>, which skips components still in their initial state, and restores the new thread's lazily, on its next return to user mode, so a kernel thread or a thread that blocks again before returning never pays for it.</li>
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
  id: "demand-paging",
  region: "os",
  title: "Demand Paging and Copy-on-Write",
  sections: [
    { id: "indirection", label: "The Page Table as a Layer of Indirection" },
    { id: "root-table", label: "Setting Up CR3 and the Root Table" },
    { id: "backing", label: "Demand Paging and Backing Objects" },
    { id: "first-touch", label: "Filling the Path on a First Touch" },
    { id: "cow", label: "Copy-on-Write After Fork" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p>Once every access goes through a page table, the OS can point any virtual page at any physical frame, or at nothing yet. Two features fall out of that one layer of indirection: loading pages only when they are touched (demand paging), and letting processes share a page until one of them writes to it (copy-on-write). The same indirection lets the OS take a frame back later and fault the page in again when it is next touched, which is covered in <a href="#/page-replacement">Page Replacement</a>. Both work by having the CPU, the OS, and user code see different things about the same page, and both rely on the page fault being precise and restartable (see <a href="#/exceptions">Faults, Traps, Interrupts, and System Calls</a>). <a href="#/mmap">Memory Mapping</a> hands the same machinery to the program. Builds on <a href="#/virtual-memory">Virtual and Physical Memory</a>. Main sources: Bryant and O’Hallaron’s <em>Computer Systems: A Programmer’s Perspective</em> (chapter 9) and Chris Kanich’s CS 361 lecture on memory mapping.</p>

<h3 id="sec-indirection">The Page Table as a Layer of Indirection</h3>
<p>Each process has its own page table, and each table maps virtual pages to physical frames however the OS likes:</p>
<ul>
<li><strong>Many to one:</strong> two virtual pages, in the same process or in different ones, can map to the same frame. That is how processes share code and memory.</li>
<li><strong>Not yet:</strong> an entry can be marked not present, so the first access faults and the OS decides what to put there.</li>
<li><strong>Lie about permissions:</strong> the entry can be stricter than what the program was promised, so the OS gets control on the first write.</li>
</ul>
<p>The table only works in one direction: given a virtual page, find the frame. Going from a frame back to every virtual page that maps it (needed to evict a shared page or to tell whether a page still has other users) takes a separate structure. Linux keeps a <strong>reverse map</strong> for this, and a per-frame count of how many page tables map it.</p>
<p>Three parties take part, and keeping them apart is the key to every example below:</p>
<ul>
<li><strong>The CPU</strong> reads the page table on every TLB miss and faults when an entry is not present or forbids the access.</li>
<li><strong>The OS</strong> writes the page table and handles the faults. It also keeps its own description of each region (on Linux, a VMA per region: its range, its real permissions, and what backs it), which can differ from the page table.</li>
<li><strong>User code</strong> sees neither. It loads and stores, and a fault that the OS fixes is invisible to it apart from the time it took.</li>
</ul>

<h3 id="sec-root-table">Setting Up CR3 and the Root Table</h3>
<p>CR3 holds the physical frame number of the running process's top-level table (the PML4 on x86-64). Only the kernel can write it: a move to CR3 is a privileged instruction, and user code that tries it takes a general-protection fault. The kernel sets it up at three moments:</p>
<ol>
<li><strong>Boot.</strong> A core can't enter 64-bit mode with paging off, so the first tables are built while every address is still physical. Early boot code writes a small set of tables into memory that map the kernel's own image, writes the physical address of the top table into CR3, and then turns paging on. (UEFI firmware already runs with paging on, using its own tables, and the kernel just loads CR3 with its own.) With paging on, the kernel builds its final tables, including the <strong>direct map</strong>: all of physical memory, mapped at one fixed virtual offset. From then on, the kernel reads and writes any frame, page tables included, at its physical address plus that offset. That is how the kernel edits tables that it can only name by physical address.</li>
<li><strong>Process creation.</strong> <code>fork</code> and <code>exec</code> each give the process a new address space, and its root table is allocated then, before the process runs: the kernel takes one free 4 KB frame from the page allocator and zeroes it. The upper half of the PML4, entries 256 to 511, maps the kernel, so the kernel copies those entries from its own reference table, and every process points at the same kernel PDPTs. The lower half, entries 0 to 255, is the user half. After <code>exec</code> it stays empty (all not present). After <code>fork</code> it holds the copy-on-write copy of the parent's entries. The kernel records the table in the process's memory descriptor (<code>mm-&gt;pgd</code> on Linux). With kernel page-table isolation (the Meltdown mitigation), each process gets two root tables instead: a full one for kernel mode, and one for user mode that maps almost none of the kernel. Kernel entry and exit then switch CR3 between the two.</li>
<li><strong>Context switch.</strong> When the scheduler switches to a thread of another process, it writes the new process's root frame number into CR3. The low 12 bits carry the process's PCID, and setting bit 63 tells the core to keep that PCID's TLB entries instead of flushing them. Without PCIDs, a CR3 write flushes every TLB entry that isn't marked global. Kernel mappings are global, so they survive either way (see <a href="#/tlb/coherence">Keeping TLBs Coherent</a>). Threads of one process share its root table, so switching between them leaves CR3 alone.</li>
</ol>
<p>The walker keeps its own copy of CR3, which the write updates, and uses it on the next TLB miss (see <a href="#/tlb/tlb-miss">From a TLB Miss to the Translation</a>).</p>

<h3 id="sec-backing">Demand Paging and Backing Objects</h3>
<p>Every region of a process's address space is backed by an object, and its pages start out not present. The mapping already says where each page's bytes come from, but they aren't read until the first touch faults them in. Pages that are never touched cost no memory and no I/O. Regions are created by <code>exec</code> when a program starts and by <code>mmap</code> afterward. The backing object is one of two kinds:</p>
<ul>
<li><strong>A regular file:</strong> page <em>i</em> of the region holds bytes <em>i</em> × 4096 onward of the file (plus the mapping's starting offset). The fault reads the page into the page cache if it isn't already there, then maps that page-cache frame.</li>
<li><strong>An anonymous object:</strong> memory with no file behind it, which reads as all zeros at first. These are called <strong>demand-zero</strong> pages: the fault hands out a freshly zeroed frame. On Linux, a read fault on an untouched anonymous page maps one shared, read-only <strong>zero page</strong> instead, so a region that is only read never uses more than that one frame. The first write then gets a private zeroed frame.</li>
</ul>
<p>How an ELF executable's segments are backed:</p>
<div class="tbl"><table>
<tr><th>Region</th><th>Backed by</th><th>Shared or private</th><th>Why</th></tr>
<tr><td><code>.text</code>, <code>.rodata</code></td><td>The executable file</td><td>Shared, read-only</td><td>Never written, so a thousand processes running <code>bash</code> share one physical copy</td></tr>
<tr><td><code>.data</code></td><td>The executable file</td><td>Private (copy-on-write)</td><td>Starts as the file's initial values, but each process's writes to its globals must stay its own</td></tr>
<tr><td><code>.bss</code></td><td>Anonymous (demand-zero)</td><td>Private</td><td>Zero-initialized globals take no space in the file, only in the address space</td></tr>
<tr><td>Heap, stack</td><td>Anonymous (demand-zero)</td><td>Private</td><td>Fresh memory, zero until written</td></tr>
<tr><td>Shared libraries</td><td>The <code>.so</code> files</td><td>Code shared, data private</td><td>Same split as the executable, so every process's copy of <code>libc</code> code is one set of frames</td></tr>
</table></div>
<div class="tbl"><svg viewBox="0 0 680 290" role="img" aria-label="Backing objects for a process's address space. The address space has five regions from top to bottom: stack, heap, bss, data, and text. Stack, heap, and bss map to the anonymous object, drawn as the shared zero page, as private demand-zero memory. Data maps to the data bytes of the executable file as a private, copy-on-write file mapping. Text maps to the text bytes of the same file as a shared, read-only file mapping. Every mapping starts not present and is faulted in on first touch." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrMM" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker><marker id="arrMMt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:11px">virtual address space (high addresses at top)</text>
<text x="430" y="18" style="fill:var(--muted);font-size:11px">backing objects</text>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5">
<rect x="20" y="30" width="180" height="34" rx="3"/><rect x="20" y="78" width="180" height="34" rx="3"/><rect x="20" y="126" width="180" height="34" rx="3"/>
</g>
<rect x="20" y="174" width="180" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="20" y="222" width="180" height="34" rx="3" style="fill:var(--code-bg);stroke:var(--muted);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="110" y="51">stack</text><text x="110" y="99">heap</text><text x="110" y="147">.bss</text><text x="110" y="195">.data (globals)</text><text x="110" y="243">.text (code)</text>
</g>
<rect x="430" y="62" width="230" height="52" rx="4" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="545" y="84" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">anonymous object</text>
<text x="545" y="100" text-anchor="middle" style="fill:var(--muted);font-size:11px">reads as zeros (shared zero page)</text>
<text x="545" y="156" text-anchor="middle" style="fill:var(--muted);font-size:11px">executable file (via the page cache)</text>
<rect x="430" y="164" width="230" height="100" rx="4" style="fill:none;stroke:var(--muted);stroke-width:1.5;stroke-dasharray:4 3"/>
<rect x="445" y="174" width="200" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="445" y="222" width="200" height="34" rx="3" style="fill:var(--code-bg);stroke:var(--muted);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle"><text x="545" y="195">.data bytes</text><text x="545" y="243">.text bytes</text></g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrMM)">
<path d="M200,47 L428,80"/><path d="M200,95 L428,88"/><path d="M200,143 L428,96"/>
<path d="M200,239 L443,239"/>
</g>
<path d="M200,191 L443,191" style="stroke:var(--trace);stroke-width:1.5;fill:none" marker-end="url(#arrMMt)"/>
<g style="font-size:11px" text-anchor="middle">
<text x="330" y="150" style="fill:var(--muted)">private, demand-zero</text>
<text x="320" y="184" style="fill:var(--trace)">private file-backed (copy-on-write)</text>
<text x="320" y="232" style="fill:var(--muted)">shared file-backed, read-only</text>
</g>
<text x="20" y="282" style="fill:var(--muted);font-size:11px">Every arrow starts as a not-present page-table entry. The first touch of each page faults it in.</text>
</svg></div>
<p>Demand paging is lazy evaluation for memory: like not studying for an exam you won't take, the OS does no work for a page until an instruction actually needs it. A <strong>minor fault</strong> finds the bytes already in memory (a zero page, or a file page already in the page cache) and costs on the order of a microsecond. A <strong>major fault</strong> waits for storage: tens of microseconds on an NVMe SSD, milliseconds on a disk. Readahead hides much of this for sequential access by pulling in neighboring file pages before they are touched.</p>
<h3 id="sec-first-touch">Filling the Path on a First Touch</h3>
<p>The page table is filled in the same lazy way as the data. <code>mmap</code> and <code>exec</code> only record a region in a VMA, and the fault handler builds whatever tables are missing on the path to the faulting page. Say CR3 points at a root table whose entry 170 is not present, because nothing in that 512 GB range has been touched yet. The process stores to 0x0000555555559ABC, the address from <a href="#/virtual-memory/multilevel">Multilevel Page Tables</a> (PML4 index 170, PDPT index 341, PD index 170, PT index 345), inside an anonymous region it created with <code>mmap</code>:</p>
<ol>
<li><strong>The walk stops at the root.</strong> The store misses in the L1 DTLB and the L2 TLB, and the walker reads PML4 entry 170 at the address built from CR3. Its P bit is clear, so the walk ends after one read: the walker marks the store's ROB entry as faulting and fills no TLB entry. x86 never caches a not-present entry, in the TLBs or in the page-walk caches.</li>
<li><strong>The core takes the fault.</strong> When the store reaches the head of the ROB, the core takes a page fault (vector 14) as described in <a href="#/exceptions/hardware-sequence">The Hardware Sequence</a>. CR2 holds the faulting address, the error code says not present, write, user mode, and the saved PC points at the store itself.</li>
<li><strong>The handler checks the access.</strong> It looks up the VMA containing the address in CR2. The address is inside an anonymous region that allows writes, so the fault is legal. An address in no region, or a write to a read-only region, would end in <code>SIGSEGV</code> instead.</li>
<li><strong>It builds the missing path, top-down.</strong> At each level it reads the entry, and if the entry is not present, it takes a frame from the page allocator, zeroes it through the direct map, and writes the entry: the new table's frame number, P = 1, and permissive flags (writable, user, executable). Here all three lower levels are missing, so it allocates a PDPT and writes PML4[170], then a page directory for PDPT[341], then a page table for PD[170]. The real permissions go only in the leaf entry. The walker ANDs the flags of every level, and one upper entry covers many regions with different permissions, so upper entries must allow everything their range might need.</li>
<li><strong>It maps the data page.</strong> For an anonymous region, that is a freshly zeroed frame. For a file-backed region, the handler looks up the file page in the page cache, and if it isn't there, reads it from storage. That makes it a major fault, and the process sleeps while other processes run. The handler then writes PT[345]: the data frame's number, P = 1, writable, user, and no-execute for a data region.</li>
<li><strong>It returns.</strong> <code>iretq</code> restores the saved state, and the store executes again. It misses in the TLB again, but this time the walk finds all four entries present. The walker sets their accessed bits, and the dirty bit in the leaf, then fills the TLBs, and the store completes.</li>
</ol>
<p>This first touch took four frames: three tables and the data page, 16 KB in all. Two details make the handler's job safe and cheap:</p>
<ul>
<li><strong>No TLB invalidation.</strong> Every entry the handler wrote was not present before, and not-present entries are never cached, so no TLB or page-walk cache on any core holds a stale copy. Adding a mapping needs no shootdown. Removing or restricting one does (see <a href="#/page-replacement/eviction">Evicting Pages</a>).</li>
<li><strong>Write order.</strong> Other threads of the process may run on other cores, and their walkers can read the table at any moment. So the kernel zeroes each new table before writing the entry that points at it, with a write barrier in between, and a concurrent walker sees either a not-present entry or a complete table, never garbage. A page-table lock keeps two threads faulting in the same range from both allocating a table.</li>
</ul>
<p>Later first touches reuse the path. A page elsewhere in the same 2 MB needs only a data frame, and the first page in the next 2 MB also needs a new page table. File-backed faults go further: Linux's fault-around maps up to 16 neighboring pages that are already in the page cache in the same fault. Tables are freed when no mapping in their range remains: <code>munmap</code> frees the tables whose whole range it removed, and process exit frees them all. Evicting a page doesn't free its table. Its entry becomes a not-present entry that records where the page went.</p>
<h3 id="sec-cow">Copy-on-Write After Fork</h3>
<p><code>fork</code> must give the child an address space identical to the parent's, after which the two must not see each other's writes. Copying every frame would be slow and wasteful, especially since most children call <code>exec</code> immediately. Copying only the page table would be fast but wrong, since the processes would then share writable frames. Copy-on-write does both: share now, copy at the last possible moment, one page at a time.</p>
<ol>
<li><strong>At fork,</strong> the kernel copies the parent's page table into the child. Every private writable page is set to read-only in <em>both</em> tables, and each frame's map count goes up. The regions themselves (the VMAs) stay writable: the OS remembers the truth even though the page table says otherwise. Already read-only pages, such as code, simply stay shared forever.</li>
<li><strong>User code stores to a private page.</strong> It believes the page is writable, because it is.</li>
<li><strong>The CPU</strong> sees a read-only entry and raises a page fault. It knows nothing about copy-on-write.</li>
<li><strong>The OS</strong> sees a write fault on a page that the region says is writable, so the fault is legal. If other page tables still map the frame, it allocates a new frame, copies the 4 KiB, points the writer's entry at the copy with write permission, and invalidates the stale TLB entry. If the writer is now the only one mapping the frame, it just makes the entry writable, with no copy.</li>
<li><strong>The store re-executes</strong> and succeeds. The program never knew.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 680 252" role="img" aria-label="Copy-on-write in three steps. Step 1, after fork: the parent and child page-table entries are both read-only and both point at frame A, which holds x equals 1 and has 2 mappings. Step 2, the child writes x equals 2: its entry is read-only, so the store faults, and the kernel sees the region is writable and the frame has 2 mappings, so it copies. Step 3, after the fault: the parent entry, still read-only, points at frame A with x equals 1 and 1 mapping, and the child entry, now read-write, points at a new frame B with x equals 2 and 1 mapping. The parent stays read-only until it writes, and then the kernel just makes the entry writable without copying." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrCW" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker><marker id="arrCWt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<g style="fill:var(--ink);font-size:12px;font-weight:600" text-anchor="middle">
<text x="117" y="18">Step 1: After Fork</text><text x="340" y="18">Step 2: Child Writes x = 2</text><text x="563" y="18">Step 3: After the Fault</text>
</g>
<g style="fill:none;stroke:var(--rule);stroke-width:1.5">
<rect x="10" y="28" width="214" height="214" rx="4"/><rect x="233" y="28" width="214" height="214" rx="4"/><rect x="456" y="28" width="214" height="214" rx="4"/>
</g>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5">
<rect x="20" y="44" width="92" height="40" rx="3"/><rect x="122" y="44" width="92" height="40" rx="3"/>
<rect x="243" y="44" width="92" height="40" rx="3"/>
<rect x="466" y="44" width="92" height="40" rx="3"/>
<rect x="67" y="150" width="100" height="44" rx="3"/><rect x="290" y="150" width="100" height="44" rx="3"/><rect x="462" y="150" width="98" height="44" rx="3"/>
</g>
<rect x="345" y="44" width="92" height="40" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<rect x="568" y="44" width="92" height="40" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="566" y="150" width="98" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px;font-weight:600" text-anchor="middle">
<text x="66" y="60">parent PTE</text><text x="168" y="60">child PTE</text>
<text x="289" y="60">parent PTE</text><text x="391" y="60">child PTE</text>
<text x="512" y="60">parent PTE</text><text x="614" y="60">child PTE</text>
<text x="117" y="168">frame A</text><text x="340" y="168">frame A</text><text x="511" y="168">frame A</text><text x="615" y="168">frame B (copy)</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="66" y="76">read-only</text><text x="168" y="76">read-only</text>
<text x="289" y="76">read-only</text><text x="391" y="76" style="fill:var(--pad)">read-only: fault</text>
<text x="512" y="76">read-only</text><text x="614" y="76" style="fill:var(--trace)">read-write</text>
<text x="117" y="184">x = 1, 2 maps</text><text x="340" y="184">x = 1, 2 maps</text><text x="511" y="184">x = 1, 1 map</text><text x="615" y="184">x = 2, 1 map</text>
<text x="117" y="216">both entries read-only,</text><text x="117" y="231">one physical copy</text>
<text x="340" y="216">region is writable and frame</text><text x="340" y="231">has 2 maps, so the kernel copies</text>
<text x="563" y="216">parent stays read-only until it</text><text x="563" y="231">writes, then no copy is needed</text>
</g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrCW)">
<path d="M66,84 L104,148"/><path d="M168,84 L130,148"/>
<path d="M289,84 L327,148"/><path d="M391,84 L353,148"/>
<path d="M512,84 L511,148"/>
</g>
<path d="M614,84 L615,148" style="stroke:var(--trace);stroke-width:1.5;fill:none" marker-end="url(#arrCWt)"/>
<text x="400" y="120" style="fill:var(--pad);font-size:11px">store</text>
</svg></div>
<p>The net effect: after a fork, physical memory grows by one page per page actually written, not by the size of the process. Pages that are never written, such as globals touched only on an error path, are never copied. The same trick serves file-backed <a href="#/mmap/flags"><code>MAP_PRIVATE</code></a> mappings like <code>.data</code>, and anonymous memory, whose untouched pages are copy-on-write views of the zero page.</p>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong>Faults are not free.</strong> A minor fault costs roughly 0.5 to 1 µs of kernel time, plus zeroing or copying the page. Touching a fresh 4 KiB page per microsecond of work halves throughput. Ways to batch this work are in <a href="#/mmap/perf">Memory Mapping</a>.</li>
<li><strong>Copy-on-write costs the parent too.</strong> Fork write-protects the parent's pages and flushes its TLB entries (with shootdowns on every core running its threads). Afterward, the parent takes a write fault on the first store to each page, even when the child has already exited.</li>
<li><strong>Huge pages make copy-on-write coarse.</strong> With 2 MiB pages, a single byte written copies 2 MiB. Redis tells users to disable transparent huge pages for this reason: its snapshot forks the server, and scattered writes during the snapshot can copy almost the whole heap.</li>
<li><strong>For a simulator:</strong> user-level traces and most syscall-emulation simulators miss fault handling entirely, so first-touch and copy-on-write costs disappear from the model. A workload that forks, or allocates and touches memory in its measured region, needs full-system simulation or a correction for the kernel time.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A Redis server holds 24 GiB of anonymous heap in 4 KiB pages, with 8-byte page-table entries. To snapshot, it forks a child that writes the data to disk. During the snapshot, clients modify 12.5% of the heap's 4 KiB pages, spread uniformly at random, and each copy-on-write fault costs 1.5 µs of kernel time including the copy.</p><ol><li>How much leaf page-table memory does fork copy?</li><li>How much extra physical memory does the snapshot need, and how much kernel time do the copy-on-write faults cost?</li><li>Redo the extra memory with 2 MiB transparent huge pages.</li></ol>`,
        a: `<ol><li>Pages = 24 GiB / 4 KiB = 6,291,456. Leaf entries = 6,291,456 × 8 B = <strong>48 MiB</strong> copied while the parent is paused.</li><li>Written pages = 12.5% × 6,291,456 = 786,432. Each gets one copy, so extra memory = 786,432 × 4 KiB = <strong>3 GiB</strong>. Kernel time = 786,432 × 1.5 µs ≈ <strong>1.18 s</strong>, spread over the snapshot and charged to the parent's request latency.</li><li>Huge pages = 24 GiB / 2 MiB = 12,288, each covering 512 small pages. A huge page is copied if any of its 512 small pages is written. The chance that none is written is 0.875<sup>512</sup> = e<sup>512 × ln 0.875</sup> ≈ e<sup>−68</sup>, effectively 0. So nearly every huge page is copied: extra memory ≈ <strong>24 GiB</strong>, 8× more, and each fault now copies 2 MiB. That is why Redis asks for transparent huge pages to be disabled.</li></ol>`
      },
      {
        q: `<p>A process on x86-64 Linux uses 4-level paging with 4 KiB pages, and transparent huge pages are off. It creates a 256 MiB anonymous region with <code>mmap</code>, which the kernel places at 0x200000000000. Nothing else is mapped in the 512 GiB range of that address's PML4 entry. The process then stores one byte to each page of the region, in address order.</p><ol><li>How many page faults does it take, how many of them allocate page tables, and how much memory do the tables use?</li><li>How many TLB shootdowns does filling the region need?</li><li>Later, reclaim evicts every page of the region to swap. How much table memory does that free?</li></ol>`,
        a: `<ol><li>Pages = 256 MiB / 4 KiB = 65,536, and every first touch faults (anonymous memory gets no fault-around): <strong>65,536 faults</strong>. The PML4 index is 0x200000000000 &gt;&gt; 39 = 64, and that entry is not present, so fault 0 allocates a PDPT, a page directory, and a page table. The region starts on a 1 GiB boundary and is smaller than 1 GiB, so one directory covers it, and it needs 256 MiB / 2 MiB = 128 page tables. Faults 512, 1,024, &hellip;, 65,024 each allocate one more: 127 faults. Total: <strong>128 faults allocate tables</strong>, and 3 + 127 = 130 tables × 4 KiB = <strong>520 KiB</strong>, about 0.2% of the region.</li><li><strong>None.</strong> Every entry the handler writes was not present before, and not-present entries are never cached, so no core can hold a stale translation.</li><li><strong>Nothing.</strong> Each leaf entry becomes a swap entry that records where its page went, so all 130 tables stay. They are the only record of the swap locations. Linux never pages tables out, and Windows could page out the 128 page tables only after their pages had all left memory.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>After fork, the parent writes to a private page, and then the child writes to the same page. How many page copies happen, and why?</p>`,
        a: `<p>One. The parent's write faults on its read-only entry. The frame still has 2 mappings, so the kernel copies it and gives the parent a private writable page, leaving the original frame with 1 mapping (the child). The child's write also faults, since its entry is still read-only, but now the kernel finds that the child is the only process mapping the frame, so it just sets the entry writable without copying. The last writer reuses the original frame.</p>`
      },
      {
        q: `<p>A 100 GiB, 32-thread service with 4 KiB pages launches a helper process with <code>fork</code> then <code>exec</code>, and its tail latency spikes. Explain why, and what <code>posix_spawn</code> changes.</p>`,
        a: `<ul><li><strong>Page-table copy:</strong> 100 GiB / 4 KiB = 26,214,400 entries × 8 B = 200 MiB of leaf entries copied while the forking thread holds the address-space lock, stalling other threads that fault or <code>mmap</code>.</li><li><strong>Write-protection:</strong> every writable page in the parent becomes read-only, which needs TLB shootdowns to every core running the other 31 threads.</li><li><strong>Fault storm:</strong> afterward, the first store to each page faults. Pages the child still maps get copied, and even after the child execs, each page needs one fault to become writable again.</li><li><strong><code>posix_spawn</code>:</strong> uses <code>clone(CLONE_VM | CLONE_VFORK)</code>, so the child runs on the parent's page table until <code>exec</code>. No copy, no write-protection, no shootdowns, and no later faults.</li></ul>`
      },
      {
        q: `<p>A program allocates 8 GiB with anonymous <code>mmap</code> and then only reads it. How much physical memory does it use, and what happens on the first write to a page?</p>`,
        a: `<p>Almost none. Each read fault on an untouched anonymous page maps the kernel's single shared zero page read-only, so all 2,097,152 pages (8 GiB / 4 KiB) point at one frame, at the cost of a page-table entry each. The first write to a page faults again, because the entry is read-only. The kernel allocates a zeroed frame (no copy is needed, since the source is known to be zeros), maps it writable, and invalidates the stale TLB entry. The cost is a second fault per page that was read before being written, which is why benchmarks that read a buffer before filling it see double the faults.</p>`
      }
    ]
  }
},

{
  id: "page-replacement",
  region: "os",
  title: "Page Replacement",
  sections: [
    { id: "eviction", label: "Evicting Pages" },
    { id: "table-eviction", label: "Paging Out Page Tables" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p><a href="#/demand-paging">Demand Paging and Copy-on-Write</a> showed how a page gets a frame: lazily, on the first touch, with the fault handler building any missing tables on the way. This page covers the reverse: how the OS takes frames back when memory runs short, which pages it picks, what happens to their page-table entries, and what it costs when the pages are needed again. Main sources: Hennessy &amp; Patterson, Appendix B, Mel Gorman's <em>Understanding the Linux Virtual Memory Manager</em>, and Russinovich, Solomon, Ionescu, and Yosifovich's <em>Windows Internals</em> (chapter 5).</p>

<h3 id="sec-eviction">Evicting Pages</h3>
<p>When memory runs short, the OS takes frames back from pages that are mapped but cold. The decision belongs entirely to the OS. The hardware only reports usage: the walker sets a leaf entry's accessed bit when it walks the entry, and its dirty bit on the first store. It never picks a victim. That is the opposite of a cache, where hardware replacement (LRU, pseudo-LRU, RRIP) chooses on every miss. A page miss costs microseconds to milliseconds, so the OS can afford a policy that runs thousands of instructions, and it knows things the hardware can't: whether a page is clean file data that can be read again, anonymous memory that needs swap space, locked in memory with <code>mlock</code>, or charged to a cgroup over its limit.</p>
<p><strong>When reclaim runs.</strong> Linux keeps three watermarks of free memory per zone: min, low, and high.</p>
<ul>
<li><strong>Free memory falls below low:</strong> the allocator wakes <code>kswapd</code>, one kernel thread per NUMA node, which reclaims in the background until free memory is back above high. Applications don't wait for it.</li>
<li><strong>An allocation would take free memory below min:</strong> the allocating thread reclaims pages itself (<strong>direct reclaim</strong>) and waits until it has enough. This is where reclaim shows up as tail latency.</li>
<li><strong>Reclaim frees nothing:</strong> the OOM killer kills a process, chosen mostly by how much memory it uses.</li>
</ul>
<p><strong>Choosing the victim.</strong> Exact LRU would need a timestamp on every access, and only the hardware sees accesses. The OS approximates LRU with the accessed bit, as the clock (second-chance) algorithm does (Hennessy &amp; Patterson, Appendix B): it sweeps over the frames, and a page whose accessed bit is set gets the bit cleared and is passed over, while a page whose bit is still clear hasn't been used since the last sweep and is evicted. Linux keeps frames on LRU lists, separate for anonymous and file pages, each split into an active and an inactive list. Reclaim scans the tail of an inactive list. It checks a page's accessed bit in every page table that maps the page, through the reverse map: a page with a set bit moves to the active list, and a page with none is evicted. Pages age from the active list into the inactive one to keep the two balanced, and <code>vm.swappiness</code> sets how hard reclaim leans on anonymous pages versus file pages. Since Linux 6.1, the multi-generational LRU (MGLRU) can replace the two lists with several generations, which it ages by walking page tables instead of the reverse map.</p>
<p>The accessed bit has a hardware catch. The walker sets it only during a walk, so while a page's translation stays in a TLB, accesses don't touch the bit. Linux on x86 clears accessed bits without flushing the TLB, to avoid a shootdown per page, so a page that stays hot in some core's TLB can look unused until that entry is evicted. TLB entries usually turn over much faster than reclaim scans, so this costs little accuracy.</p>
<p><strong>Evicting the victim.</strong></p>
<ol>
<li><strong>Find every mapping.</strong> Through the reverse map, the kernel finds each page-table entry that maps the frame: one for a private page, possibly thousands for a page of <code>libc</code>.</li>
<li><strong>Clear the entries.</strong> Each entry becomes not present. For an anonymous page, the kernel first assigns a swap slot and writes a <strong>swap entry</strong> in place of the old one: P = 0, with the swap device and offset in the other bits. The hardware ignores every other bit of an entry whose P bit is clear, so the OS is free to store anything there. For a file page, the entry is simply cleared, since the VMA already says which file offset backs it.</li>
<li><strong>Shoot down the TLBs.</strong> Any core may still cache the old translation, and a core holding a stale entry could keep reading or writing the frame after it has been reused. The kernel invalidates the entry on every core that may hold it and waits for all of them to confirm (the protocol is in <a href="#/tlb/coherence">Keeping TLBs Coherent</a>). Reclaim batches many pages per shootdown to spread its cost.</li>
<li><strong>Write back if needed.</strong> If the page is dirty, its contents go to the swap slot or back to the file. A clean file page, such as program code, is just dropped, because the file still holds its bytes. A clean anonymous page that already has a copy in swap skips the write too.</li>
<li><strong>Free the frame.</strong> The frame goes back to the page allocator only once the shootdown and any write have completed.</li>
</ol>
<p>The next access to the page walks to the not-present entry and faults. For a swap entry, the handler reads the page back from swap, which is a major fault, unless the page is still in the <strong>swap cache</strong> (written out but not yet freed), which makes it a minor one. Windows does the same work in a different shape: it trims each process's working set separately, and trimmed pages wait on a standby list (or on a modified list until they are written), where a touch brings them back with a soft fault. When the pages that running processes keep using add up to more than physical memory, every eviction removes a page that is needed again soon, and the system spends its time in major faults instead of doing work. That is <strong>thrashing</strong>.</p>

<h3 id="sec-table-eviction">Paging Out Page Tables</h3>
<p>Page tables live in ordinary frames, so an OS can evict them too. Linux never does. A process's tables are a fraction of a percent of the memory they map, the kernel walks them constantly for faults and reclaim, and an empty table is simply freed. Windows does page out the page tables of user processes, with one condition: a page table can leave memory only once none of its entries points at a page still in memory (its frame-database entry counts them). The hardware isn't told any of this. It reaches a not-present entry and faults, exactly as it does for a data page.</p>
<p>Evicting the page table that covers one 2 MB range takes these steps:</p>
<ol>
<li><strong>Wait until the table maps nothing.</strong> Every data page under it has been evicted, so all 512 entries are not present, and most hold the disk location of their page. (If all 512 are empty, the table can be freed without being written.)</li>
<li><strong>Write the table out.</strong> The table's 4 KB go to the pagefile like any data page. Its entries have to be saved, because they are the only record of where the data pages went.</li>
<li><strong>Clear the parent entry.</strong> The page-directory entry that pointed at the table becomes not present, with the table's pagefile location in its other bits.</li>
<li><strong>Flush the paging-structure caches.</strong> No TLB holds a translation through the table, since all its entries were already not present. But a page-walk cache may still hold the old page-directory entry and send a walk straight to the old frame. On x86, <code>invlpg</code> for any address also flushes the paging-structure caches for the current PCID, and a shootdown does the same on the other cores (see <a href="#/tlb/coherence">Keeping TLBs Coherent</a>).</li>
<li><strong>Free the frame.</strong></li>
</ol>
<p>A later access to that 2 MB range plays out in this order:</p>
<ol>
<li><strong>The walk stops one level early.</strong> The walker reads the PML4 and PDPT entries, which are present, and then the page-directory entry, whose P bit is clear. It stops there and marks the access as faulting, so it never fetches a line from the missing table. That is why the walk itself never needs anything that isn't in DRAM (see <a href="#/page-walk/walk">What a Page Walk Does</a>).</li>
<li><strong>The handler restores the table.</strong> It finds a pagefile location in the page-directory entry, allocates a frame, reads the table back, and writes the page-directory entry with P = 1.</li>
<li><strong>It restores the data page.</strong> The table's entry for the faulting page is itself not present, because the data page left first. The handler can read the data page in the same fault, or return and let the access fault a second time on the leaf entry. Either way, the access waits for two reads from storage, one after the other.</li>
</ol>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong>Major faults dominate quickly.</strong> With DRAM accesses near 100 ns and a swap-in from an NVMe SSD near 100 µs, one access in a thousand that faults roughly doubles the average access time. A workload whose hot pages don't fit in memory slows down by orders of magnitude, not percent.</li>
<li><strong>Direct reclaim lands on the request path.</strong> <code>kswapd</code> reclaims in the background, but a burst of allocations can outrun it and push threads into direct reclaim, which shows up as latency spikes. Raising the watermarks (<code>vm.watermark_scale_factor</code> or <code>vm.min_free_kbytes</code>) wakes <code>kswapd</code> earlier, trading some unused memory for steadier latency.</li>
<li><strong>Shootdowns cost every core that runs the process.</strong> Each eviction batch sends inter-processor interrupts, which cost the sender microseconds of waiting and interrupt the receivers. Evicting a page shared by many processes, such as a library page, reaches the most cores.</li>
<li><strong>Compressed swap trades CPU for I/O.</strong> zram (Linux) and memory compression (Windows, macOS) keep evicted pages compressed in RAM, so a swap-in costs a few microseconds of decompression instead of a storage read.</li>
<li><strong>For a simulator:</strong> user-level and syscall-emulation simulators give the workload all the memory it asks for, so eviction never happens. If the real system runs under memory pressure, use full-system simulation or add the major faults as a rate times a latency.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix B · Mel Gorman, <em>Understanding the Linux Virtual Memory Manager</em> · Russinovich, Solomon, Ionescu, and Yosifovich, <em>Windows Internals</em>, 7th edition, Part 1, chapter 5 · Intel, <em>Intel 64 and IA-32 Architectures Software Developer's Manual</em>, Volume 3, Chapter 4 (paging)</p>`,
  practice: {
    guided: [
      {
        q: `<p>A key-value store's memory accesses take 90 ns on average when the page they touch is in memory. Its server swaps to an NVMe SSD, where a major fault costs 80 µs in all, including the kernel's work. Assume every fault is a major fault and nothing else changes.</p><ol><li>What fraction of accesses can fault before the average access time doubles?</li><li>What fraction can fault before it rises by only 10%?</li></ol>`,
        a: `<ol><li>Average access time = 90 ns + <em>p</em> × 80,000 ns. It doubles when <em>p</em> × 80,000 = 90, so <em>p</em> = 90 / 80,000 = <strong>1.125 × 10<sup>−3</sup></strong>, about 1 access in 889.</li><li>A 10% rise means <em>p</em> × 80,000 = 9, so <em>p</em> = <strong>1.125 × 10<sup>−4</sup></strong>, about 1 access in 8,889.</li><li>A fault is about 890 times as expensive as a normal access, so even a tiny fault rate dominates. That is why a workload whose hot pages don't fit in memory thrashes instead of slowing down gradually.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A Linux x86-64 server pins a latency-critical thread to one Golden Cove core. The thread reads a 4 KiB page of a lookup table every 2 µs and touches only 40 pages in all, so their translations stay in the core's 2,048-entry L2 TLB. Under memory pressure, reclaim swaps that hot page out anyway, and the thread's next read takes a 90 µs major fault. How did reclaim conclude that the page was cold, and what are two fixes?</p>`,
        a: `<ol><li>Reclaim judges a page by its accessed bit, and the walker sets that bit only during a walk. Linux on x86 clears accessed bits without flushing the TLB.</li><li>The thread is pinned, its 40 translations fit easily in the TLB, and with PCIDs even a context switch doesn't flush them. So after reclaim cleared the bit, the thread's reads all hit in the TLB, no walk ran, and the bit stayed clear.</li><li>When reclaim scanned the page again, the bit was still clear, so the page looked unused and was evicted. Eviction cleared the entry and shot down the TLB, so the next read walked, found a swap entry, and faulted.</li><li><strong>Fix 1:</strong> lock the table in memory with <code>mlock</code>, which moves its pages to the unevictable list.</li><li><strong>Fix 2:</strong> put the service in a memory cgroup with <code>memory.min</code> covering its working set, or <code>memory.swap.max</code> = 0, so reclaim takes memory from other cgroups first.</li></ol>`
      }
    ]
  }
},

{
  id: "mmap",
  region: "os",
  title: "Memory Mapping",
  sections: [
    { id: "mmap", label: "Mapping a File with mmap" },
    { id: "flags", label: "Shared and Private Mappings" },
    { id: "change", label: "Changing and Removing Mappings" },
    { id: "malloc", label: "Where malloc Gets Its Memory" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p><a href="#/demand-paging">Demand Paging and Copy-on-Write</a> showed that every region of an address space is a lazily faulted view of some backing object. <code>mmap</code> lets a program create such regions itself: map a file and read it with plain loads, share memory with another process, or get fresh zeroed memory. A small family of calls then changes or removes them. Main sources: Bryant and O’Hallaron’s <em>Computer Systems: A Programmer’s Perspective</em> (sections 9.8 and 9.9), Chris Kanich’s CS 361 lecture on memory mapping, and the Linux man pages for <code>mmap</code>, <code>madvise</code>, and <code>mallopt</code>.</p>

<h3 id="sec-mmap">Mapping a File with mmap</h3>
<p><code>mmap(addr, length, prot, flags, fd, offset)</code> asks the kernel to create a region whose pages are backed by <code>fd</code> starting at <code>offset</code>. Passing <code>NULL</code> for <code>addr</code> lets the kernel pick the address. After that one call, byte <em>k</em> of the file is just address <em>base</em> + <em>k</em>, and reading or writing it is an ordinary load or store.</p>
<pre><code>/* read(): one system call and one copy per buffer */
char buf[65536];
while ((n = read(fd, buf, sizeof buf)) &gt; 0)
    sum += checksum(buf, n);

/* mmap(): one system call, then plain loads */
struct stat st;
fstat(fd, &amp;st);
const char *p = mmap(NULL, st.st_size, PROT_READ, MAP_PRIVATE, fd, 0);
close(fd);                       /* the mapping keeps the file open */
sum = checksum(p, st.st_size);   /* first touch of each page faults it in */
munmap((void *)p, st.st_size);</code></pre>
<p>What changes compared with <code>read</code>, <code>write</code>, and <code>lseek</code>:</p>
<ul>
<li><strong>No system call per access.</strong> Each <code>read</code> crosses into the kernel and back. With many small reads, such as random lookups into an index, those crossings dominate. With <code>mmap</code>, a page that is already mapped costs only a load.</li>
<li><strong>No extra copy.</strong> <code>read</code> copies from the page cache into the user buffer. A mapping points the page table at the page-cache frame itself.</li>
<li><strong>The program tracks its own position.</strong> There is no file offset. Random access is just pointer arithmetic.</li>
<li><strong>The cost moves to page faults.</strong> Each first touch of a page is a fault, and errors arrive as signals (<code>SIGBUS</code> if the file shrinks under the mapping) rather than return codes.</li>
</ul>
<p>The executable loader uses exactly this mechanism to map ELF segments (see <a href="#/comp-load">Loading and Running</a>), and <code>malloc</code> uses anonymous <code>mmap</code> for large blocks.</p>

<h3 id="sec-flags">Shared and Private Mappings</h3>
<p>The <code>flags</code> argument decides who sees writes:</p>
<div class="tbl"><table>
<tr><th></th><th><code>MAP_SHARED</code></th><th><code>MAP_PRIVATE</code></th></tr>
<tr><td>File-backed</td><td>Writes go to the page-cache page, are seen by every process mapping the file, and reach the file on writeback or <code>msync</code></td><td>Copy-on-write: reads see the file, the first write to a page makes a private copy, and writes never reach the file</td></tr>
<tr><td>Anonymous (<code>MAP_ANONYMOUS</code>)</td><td>Zeroed memory that stays shared with children after <code>fork</code></td><td>Ordinary private memory (large <code>malloc</code> blocks, thread stacks)</td></tr>
</table></div>
<p>A <code>MAP_SHARED</code> region set up before <code>fork</code> stays one set of frames in both processes. If the parent stores 50 to a variable there, the child's next load of it sees 50. It is the cheapest form of interprocess communication, but it is a raw bulletin board: nothing notifies the other process that something changed, so real use needs atomics, futexes, or another signal on top (see <a href="#/c11-ordering">C11 Memory Ordering</a>).</p>

<h3 id="sec-change">Changing and Removing Mappings</h3>
<p>Each call below edits both the OS's list of regions and the page table. The page-table edits cost the most, because a stale translation may sit in any core's TLB.</p>
<ul>
<li><strong><code>munmap(addr, len)</code></strong> removes the range. Private pages are freed, and dirty pages of a shared file mapping stay in the page cache for writeback. Every core that may hold a translation for the range must drop it, so the kernel sends an inter-processor interrupt to each core running a thread of the process and waits until all of them have flushed. This is a <strong>TLB shootdown</strong>.</li>
<li><strong><code>mprotect(addr, len, prot)</code></strong> changes permissions, for example to make a JIT's freshly written code executable and no longer writable. Removing a permission needs a shootdown before the call returns, or another core could keep writing through a stale writable entry.</li>
<li><strong><code>madvise(addr, len, advice)</code></strong> gives hints. <code>MADV_WILLNEED</code> starts readahead, and <code>MADV_SEQUENTIAL</code> and <code>MADV_RANDOM</code> tune it. <code>MADV_DONTNEED</code> drops the pages but keeps the region, so the next touch of a private anonymous page faults in a fresh zeroed one. Allocators use it, or the lazier <code>MADV_FREE</code>, to give memory back without unmapping.</li>
<li><strong><code>msync(addr, len, MS_SYNC)</code></strong> writes a shared file mapping's dirty pages to storage and waits. It is the mapping counterpart of <code>fsync</code> (see <a href="#/file-syscalls/durability">Metadata and Durability</a>).</li>
</ul>

<h3 id="sec-malloc">Where malloc Gets Its Memory</h3>
<p><code>malloc</code> is a library function, not a system call. It carves blocks out of memory it gets from the kernel in large pieces, through one of two calls:</p>
<ul>
<li><strong><code>brk</code></strong> moves the end of the heap, a single anonymous region that starts a random offset past <code>.bss</code>. glibc serves small blocks from it and reuses freed ones without asking the kernel again. It can only shrink the heap from the top.</li>
<li><strong>Anonymous <code>mmap</code></strong> gives each large block a region of its own. In glibc, that means requests of at least <code>M_MMAP_THRESHOLD</code>, 128 KiB by default. <code>free</code> on such a block calls <code>munmap</code>, so the memory goes straight back to the kernel.</li>
</ul>
<p>glibc raises the threshold by itself when a program frees an mmap-backed block (up to 32 MiB on 64-bit systems), so a program that keeps allocating and freeing one large size soon gets it from the heap instead. Setting the threshold with <code>mallopt</code> turns that adjustment off. Allocators such as jemalloc, tcmalloc, and mimalloc map memory in large chunks and hand it back with <code>madvise</code>, in batches, which avoids most of these calls.</p>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong>mmap is not always faster than read.</strong> For large sequential scans, <code>read</code> with a big buffer pays few system calls, and its copy is cheap compared with per-page faults, TLB misses, and TLB shootdowns when mappings change.</li>
<li><strong>Batch the faults.</strong> <code>MAP_POPULATE</code> faults in the whole range during the <code>mmap</code> call, <code>madvise(MADV_WILLNEED)</code> reads ahead, and the kernel's fault-around maps up to 16 already-cached file pages per fault. Each turns many small faults into one larger piece of work.</li>
<li><strong>Unmapping is expensive in threaded programs.</strong> A shootdown interrupts every core running the process, and each costs on the order of microseconds. Allocators that cache freed memory instead of unmapping it, and kernels that batch invalidations, exist largely to avoid this.</li>
<li><strong>Database systems mostly avoid mmap for their buffer pool.</strong> Crotty, Leis, and Pavlo (CIDR 2022) list the reasons: the kernel decides when pages are evicted and written back, I/O errors arrive as signals, page-table contention and shootdowns limit scaling, and the kernel may write a dirty page back at any moment, even before the transaction that changed it commits.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A program checksums a 2 GiB file that is already in the page cache. Compare two versions:</p><ul><li><code>read</code> into a 64 KiB buffer: each call costs 1 µs of overhead, and the copy runs at 10 GB/s.</li><li><code>mmap</code> with 4 KiB pages and no copy: a minor fault that maps one page costs 0.8 µs, and a fault with fault-around that maps 16 pages at once costs 2 µs.</li></ul><p>Ignore the checksum work itself, which is the same in both. Which is faster, with and without fault-around?</p>`,
        a: `<ol><li>File size = 2 GiB = 2,147,483,648 B.</li><li><code>read</code>: calls = 2 GiB / 64 KiB = 32,768, costing 32,768 × 1 µs = 32.8 ms. Copy = 2,147,483,648 B / 10<sup>10</sup> B/s = 214.7 ms. Total ≈ <strong>247.5 ms</strong>.</li><li><code>mmap</code> without fault-around: faults = 2 GiB / 4 KiB = 524,288, costing 524,288 × 0.8 µs ≈ <strong>419.4 ms</strong>. Slower than <code>read</code>, even with no copy.</li><li><code>mmap</code> with fault-around: faults = 524,288 / 16 = 32,768, costing 32,768 × 2 µs ≈ <strong>65.5 ms</strong>, about 3.8× faster than <code>read</code>.</li><li>Lesson: <code>mmap</code> wins only when per-page fault work is batched or amortized. Its advantage is the missing copy, and a fault per 4 KiB page can cost more than that copy.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Process A maps a file with <code>MAP_SHARED</code> and process B maps the same file with <code>MAP_PRIVATE</code>. A writes a byte. Does B see it? Does the answer change over time?</p>`,
        a: `<p>It depends on whether B has written to that page yet. Until B writes, its entry points at (or will fault in) the same page-cache frame that A writes to, so on Linux B sees A's update. POSIX leaves this unspecified. Once B writes anywhere in that page, the copy-on-write fault gives B a private copy, and from then on B sees neither A's later writes to that page nor any change to the file. Other pages that B hasn't written still track the file. So B's view is a page-by-page mix of live file contents and its own snapshot.</p>`
      },
      {
        q: `<p>A single-threaded program on x86-64 Linux with glibc calls <code>mallopt(M_MMAP_THRESHOLD, 128 * 1024)</code>. Then, 10,000 times, it calls <code>malloc(1 &lt;&lt; 20)</code>, writes every byte of the 1 MiB block, and frees it. Pages are 4 KiB, transparent huge pages are off, and glibc puts a 16-byte header in front of each mmap-backed block. What kernel work does each iteration cause, how many page faults happen in total, and what would you change?</p>`,
        a: `<ol><li>1 MiB is above the 128 KiB threshold, and setting the threshold turned off glibc's automatic adjustment, so every <code>malloc</code> calls <code>mmap</code> for a new region.</li><li>The region holds the 16-byte header plus 1,048,576 bytes, rounded up to whole pages: 1,048,592 B needs 257 pages. Writing the block touches bytes 16 through 1,048,591 of the region, which span all 257 pages, so each iteration takes <strong>257</strong> demand-zero faults, and the kernel zeroes 257 frames that the program then overwrites.</li><li><code>free</code> calls <code>munmap</code>, which frees the frames and invalidates their TLB entries (no shootdown, since only one core runs the process).</li><li>Total faults = 10,000 × 257 = <strong>2,570,000</strong>, plus 20,000 system calls.</li><li>Fixes: reuse one buffer across iterations, leave the threshold alone (glibc would raise it to the block size after the first <code>free</code> and serve later blocks from the heap), or use an allocator that keeps freed memory mapped.</li></ol>`
      },
      {
        q: `<p>A service runs 64 threads, each pinned to its own core and running continuously. One thread calls <code>munmap</code> on a 2 MiB buffer. Why is this much slower than the same call in a single-threaded process, and how do allocators avoid paying it often?</p>`,
        a: `<p>In the single-threaded process, the kernel removes the entries and invalidates its own core's TLB, and nothing else is involved. With 64 running threads, any of the other 63 cores may have cached translations for the buffer, so the kernel must perform a TLB shootdown: it sends an inter-processor interrupt to each of those cores and waits until every one has taken the interrupt, flushed the entries, and acknowledged. Each target core pays an interrupt (a pipeline flush and a trip through the kernel), and the calling thread waits for the slowest of 63 cores, so the call takes microseconds instead of a fraction of one, and every other thread is disturbed too. Allocators avoid this by keeping freed memory mapped and reusing it, and by returning memory to the kernel rarely and in large batches, so one shootdown covers many pages.</p>`
      }
    ]
  }
},

{
  id: "file-syscalls",
  region: "os",
  title: "File System Calls",
  sections: [
    { id: "descriptors", label: "File Descriptors and the Three Tables" },
    { id: "open-close", label: "Opening and Closing Files" },
    { id: "read-write", label: "Reading and Writing" },
    { id: "sharing", label: "Sharing Descriptors: fork, dup2, and pipe" },
    { id: "durability", label: "Metadata and Durability" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p>Unix gives every kind of I/O one interface. Files, pipes, sockets, and devices are all read and written through small integers called file descriptors. Five calls cover most programs: <code>open</code>, <code>read</code>, <code>write</code>, <code>lseek</code>, and <code>close</code>, each one trap into the kernel (see <a href="#/exceptions/system-calls">System Calls</a>). Main sources: Bryant and O’Hallaron’s <em>Computer Systems: A Programmer’s Perspective</em> (chapter 10), Arpaci-Dusseau’s <em>Operating Systems: Three Easy Pieces</em> (chapter 39, on files and directories), and the Linux man pages.</p>

<h3 id="sec-descriptors">File Descriptors and the Three Tables</h3>
<p>A descriptor is an index into the process's <strong>descriptor table</strong>. By convention, 0 is standard input, 1 is standard output, and 2 is standard error. Behind the index sit three levels of kernel state:</p>
<div class="tbl"><table>
<tr><th>Table</th><th>One entry per</th><th>Holds</th></tr>
<tr><td>Descriptor table</td><td>Descriptor, in each process</td><td>A pointer to an open-file entry, and the close-on-exec flag</td></tr>
<tr><td>Open-file table</td><td>Call to <code>open</code>, system-wide</td><td>The current offset, the access mode and status flags (such as <code>O_APPEND</code>), and a reference count</td></tr>
<tr><td>Inode table</td><td>File, system-wide</td><td>Size, owner, permissions, timestamps, where the data lives, and the file's pages in the page cache</td></tr>
</table></div>
<p>The middle level is the one people forget, and it explains every sharing rule. Two descriptors share an offset exactly when they point at the same open-file entry. Opening a file twice gives two entries and two independent offsets. <code>dup2</code> and <code>fork</code> make a second descriptor that points at the existing entry, so a read through either one moves both.</p>
<div class="tbl"><svg viewBox="0 0 680 250" role="img" aria-label="The three tables after fork. The parent opened log.txt as descriptor 3 and then forked. Parent descriptor 3 and child descriptor 3 both point at one open-file entry with offset 4096 and reference count 2. The child then opened log.txt again as descriptor 4, which points at a second open-file entry with offset 0 and reference count 1. Both open-file entries point at the same inode for log.txt, size 8192." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrFD" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker><marker id="arrFDt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<g style="fill:var(--muted);font-size:11px">
<text x="20" y="18">descriptor tables (per process)</text><text x="270" y="18">open-file table</text><text x="530" y="18">inode table</text>
</g>
<g style="fill:var(--ink);font-size:12px;font-weight:600"><text x="20" y="44">parent</text><text x="20" y="118">child</text></g>
<rect x="20" y="50" width="150" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="20" y="124" width="150" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="20" y="154" width="150" height="30" rx="3" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<rect x="270" y="60" width="190" height="50" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="270" y="150" width="190" height="50" rx="3" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<rect x="530" y="100" width="130" height="60" rx="3" style="fill:var(--code-bg);stroke:var(--muted);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="95" y="70">fd 3</text><text x="95" y="144">fd 3</text><text x="95" y="174">fd 4</text>
<text x="365" y="81">offset 4096</text><text x="365" y="171">offset 0</text>
<text x="595" y="126">log.txt</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="365" y="99">refs 2</text><text x="365" y="189">refs 1</text><text x="595" y="144">size 8192</text>
</g>
<g style="stroke:var(--trace);stroke-width:1.5;fill:none" marker-end="url(#arrFDt)">
<path d="M170,65 L268,78"/><path d="M170,139 L268,94"/>
</g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#arrFD)">
<path d="M170,169 L268,174"/><path d="M460,85 L528,118"/><path d="M460,175 L528,144"/>
</g>
<text x="20" y="226" style="fill:var(--muted);font-size:11px">After fork, both copies of fd 3 share one entry, so they share one offset. The child's own open of the</text>
<text x="20" y="241" style="fill:var(--muted);font-size:11px">same file creates a second entry with an independent offset. Both entries lead to the one inode.</text>
</svg></div>

<h3 id="sec-open-close">Opening and Closing Files</h3>
<p><code>int fd = open(path, flags, mode)</code> does three things:</p>
<ol>
<li><strong>Resolves the path</strong> one component at a time, checking search permission on each directory. The kernel's directory-entry cache keeps recent lookups in memory, so a hot path needs no I/O.</li>
<li><strong>Checks permission</strong> for the requested access against the file's owner, group, and mode bits.</li>
<li><strong>Allocates</strong> a new open-file entry and the lowest unused descriptor number, and returns that number. On failure it returns −1 and sets <code>errno</code>, for example to <code>ENOENT</code> (no such file), <code>EACCES</code> (permission denied), or <code>EMFILE</code> (the process is out of descriptors).</li>
</ol>
<p>The flags that matter most:</p>
<ul>
<li><code>O_RDONLY</code>, <code>O_WRONLY</code>, or <code>O_RDWR</code> sets the access mode.</li>
<li><code>O_CREAT</code> creates the file if it doesn't exist, with permissions <code>mode</code> masked by the process's umask. Adding <code>O_EXCL</code> makes the call fail if the file exists, an atomic way to take a lock file.</li>
<li><code>O_TRUNC</code> sets the size to 0.</li>
<li><code>O_APPEND</code> moves the offset to the end of the file before every write.</li>
<li><code>O_CLOEXEC</code> closes the descriptor automatically on <code>exec</code>, so it doesn't leak into programs the process starts.</li>
<li><code>O_DIRECT</code> bypasses the page cache and moves data straight between storage and the user buffer, which must then be aligned.</li>
</ul>
<p><code>close(fd)</code> frees the descriptor number and drops one reference to the open-file entry. The entry is freed only when its count reaches zero. That is why a pipe's reader sees end of file only after <em>every</em> descriptor for the write end, in every process, is closed. <code>close</code> does not write anything to storage.</p>

<h3 id="sec-read-write">Reading and Writing</h3>
<p><code>ssize_t n = read(fd, buf, count)</code> copies up to <code>count</code> bytes from the current offset into <code>buf</code>, advances the offset by <code>n</code>, and returns <code>n</code>. It can return less than was asked for, a <strong>short count</strong>, so correct code loops until it has what it needs:</p>
<ul>
<li><strong>0</strong> means end of file, or that every writer of a pipe has closed it.</li>
<li><strong>Fewer than <code>count</code></strong> happens near the end of a file, on pipes and sockets (whatever has arrived so far), and on terminals (one line at a time).</li>
<li><strong>−1 with <code>EINTR</code></strong> means a signal arrived before any data was transferred.</li>
</ul>
<p>For a regular file, <code>read</code> looks up each page in the page cache. A miss starts I/O and puts the process to sleep, and readahead fetches the following pages at the same time. A hit costs only a copy, done by the kernel from the page-cache frame into the user buffer.</p>
<p><code>write(fd, buf, count)</code> copies the other way: into page-cache pages, which are marked dirty, and then returns. The data reaches storage later, when the kernel's writeback flushes it (after about 30 seconds by default on Linux, or sooner under memory pressure). A successful <code>write</code> means other processes will see the data, not that the data would survive a power loss.</p>
<p><code>lseek(fd, offset, whence)</code> moves the offset without doing any I/O. <code>pread</code> and <code>pwrite</code> take an explicit offset and leave the shared one alone, so threads sharing a descriptor can do positioned I/O without racing on it.</p>

<h3 id="sec-sharing">Sharing Descriptors: fork, dup2, and pipe</h3>
<ul>
<li><strong><code>fork</code></strong> copies the descriptor table, so every child descriptor points at the same open-file entry as the parent's, and the two share offsets.</li>
<li><strong><code>dup2(oldfd, newfd)</code></strong> makes <code>newfd</code> point at <code>oldfd</code>'s entry, closing whatever <code>newfd</code> referred to first. This is how a shell redirects output.</li>
<li><strong><code>pipe(fds)</code></strong> creates a kernel buffer with a read end, <code>fds[0]</code>, and a write end, <code>fds[1]</code>. On Linux, the buffer holds 64 KiB by default. A writer blocks while it is full, and a reader blocks while it is empty. Writes of up to <code>PIPE_BUF</code> bytes (4096 on Linux) are atomic, so writes from several processes never interleave within one such write.</li>
</ul>
<p>A shell running <code>ls | wc -l</code> uses all three:</p>
<ol>
<li>The shell calls <code>pipe</code> and gets descriptor 3 (the read end) and 4 (the write end).</li>
<li>It forks twice. The first child calls <code>dup2(4, 1)</code>, pointing its standard output at the pipe. The second calls <code>dup2(3, 0)</code>, pointing its standard input at it.</li>
<li>Each child closes 3 and 4 and calls <code>execve</code>. The descriptor table survives <code>exec</code>, so <code>ls</code> writes into the pipe without knowing it.</li>
<li>The shell closes its own copies of 3 and 4 and waits for both children. If it kept 4 open, <code>wc</code> would never see end of file, since a write end would still exist.</li>
</ol>

<h3 id="sec-durability">Metadata and Durability</h3>
<ul>
<li><strong><code>stat(path, &amp;st)</code></strong> and <strong><code>fstat(fd, &amp;st)</code></strong> read the inode: size, mode, owner, timestamps, and the preferred I/O size, <code>st_blksize</code>.</li>
<li><strong><code>unlink(path)</code></strong> removes a name. The inode and its data are freed only once no name and no open-file entry refers to them, so a program can keep using a file it has already deleted.</li>
<li><strong><code>rename(oldpath, newpath)</code></strong> replaces <code>newpath</code> atomically. A process opening that name sees either the old file or the new one, never a mix.</li>
<li><strong><code>fsync(fd)</code></strong> writes the file's dirty pages and metadata to storage, tells the device to flush its own volatile cache, and waits. <code>fdatasync</code> skips metadata that isn't needed to read the data back, such as the modification time.</li>
</ul>
<p>Together these give the standard crash-safe way to replace a file's contents:</p>
<ol>
<li>Write the new contents to a temporary file in the same directory.</li>
<li><code>fsync</code> the temporary file, so its data is on storage.</li>
<li><code>rename</code> it over the old name.</li>
<li><code>fsync</code> the directory, so the rename itself is on storage.</li>
</ol>
<p>After a crash at any point, the name refers to either the complete old file or the complete new one.</p>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong>Small calls are expensive.</strong> Each call pays a kernel crossing, so reading one byte per <code>read</code> is around a thousand times slower than reading 64 KiB at a time. The C library's <code>FILE</code> streams (<code>fread</code>, <code>fgets</code>, <code>printf</code>) exist to batch calls, with a buffer of <code>st_blksize</code> bytes, usually 4 KiB.</li>
<li><strong>The copy is the other cost.</strong> Reading cached data runs at memory-copy bandwidth, around 10 GB/s on one core, and leaves two copies of every byte in the caches. <code>sendfile</code> and <code>splice</code> move data between a file and a socket or pipe inside the kernel with no user-space copy, and <a href="#/mmap">mmap</a> maps the page-cache frames directly.</li>
<li><strong><code>fsync</code> sets commit latency.</strong> A flush takes from tens of microseconds to milliseconds depending on the device, so databases group many transactions into one <code>fsync</code> (group commit).</li>
<li><strong>Batch the calls themselves.</strong> <code>io_uring</code> lets a program queue hundreds of reads and writes in rings shared with the kernel and submit them all with one call.</li>
<li><strong>For a simulator:</strong> I/O-heavy workloads spend much of their time in these paths: the kernel's copy loops, page-cache lookups, and the crossings themselves. A user-only trace sees only the gaps between calls.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A log parser reads a 512 MiB file that is already in the page cache. Compare three versions:</p><ul><li><code>read(fd, &amp;c, 1)</code> for every byte.</li><li><code>fgets</code> on a <code>FILE</code> stream, which calls <code>read</code> with a 4 KiB buffer.</li><li><code>read</code> into a 1 MiB buffer, splitting lines by hand.</li></ul><p>Each <code>read</code> call costs 180 ns of fixed overhead, and the kernel copies at 8 GB/s. Ignore line splitting and any copying in user space, which cost the same in all three. How long does the I/O take in each version?</p>`,
        a: `<ol><li>File size = 512 MiB = 536,870,912 B. The kernel copies every byte once in all three versions: 536,870,912 B / (8 × 10<sup>9</sup> B/s) = 67.1 ms.</li><li>1-byte reads: 536,870,912 calls × 180 ns = 96.6 s. Total ≈ <strong>96.7 s</strong>.</li><li><code>fgets</code>: 536,870,912 / 4096 = 131,072 calls × 180 ns = 23.6 ms. Total ≈ <strong>90.7 ms</strong>.</li><li>1 MiB buffer: 512 calls × 180 ns = 0.09 ms. Total ≈ <strong>67.2 ms</strong>.</li><li>Buffering gives about a 1,000× speedup. Past 4 KiB, the copy dominates, so the next step is to remove the copy (for example with <code>mmap</code>), not to grow the buffer.</li></ol>`
      },
      {
        q: `<p>A program runs the code below and creates a new, empty <code>out.txt</code>. What does the file contain at the end? What would it contain if the child, instead of using the inherited <code>fd</code>, opened <code>out.txt</code> itself with <code>O_WRONLY</code> and wrote through that?</p><pre><code>int fd = open("out.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
write(fd, "ab", 2);
if (fork() == 0) {
    write(fd, "cd", 2);
    _exit(0);
}
wait(NULL);
write(fd, "ef", 2);</code></pre>`,
        a: `<ol><li><code>open</code> creates one open-file entry with offset 0. The parent writes "ab" at offset 0, and the offset becomes 2.</li><li><code>fork</code> copies the descriptor table, so the child's <code>fd</code> points at the same entry.</li><li>The child writes "cd" at offset 2, and the shared offset becomes 4.</li><li>The parent waits for the child, then writes "ef" at offset 4. The file is <strong>abcdef</strong>.</li><li>With its own <code>open</code>, the child gets a second entry with offset 0 (no <code>O_APPEND</code>, no <code>O_TRUNC</code>). It writes "cd" over "ab", so the file is "cd".</li><li>The parent's entry still has offset 2, so it writes "ef" at offset 2. The file is <strong>cdef</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Two processes each open the same log file with <code>O_WRONLY</code> (no <code>O_APPEND</code>), call <code>lseek(fd, 0, SEEK_END)</code> once at startup, and then each write 120-byte records with one <code>write</code> call per record. What goes wrong, and how does <code>O_APPEND</code> fix it? Assume a local file system, not NFS.</p>`,
        a: `<p>Each process has its own open-file entry and its own offset, set once to the end of the file at startup. When process A writes a record at offset X, process B's offset is still X too, so B's next record lands on top of A's and overwrites it. Seeking to the end before every write doesn't fix it: the <code>lseek</code> and the <code>write</code> are two calls, and the other process can write in between. With <code>O_APPEND</code>, the kernel moves the offset to the current end of the file and writes the data as one step under the inode's lock, so every record lands after the previous one and none overlap. Records from the two processes still interleave, but each 120-byte record stays whole. On NFS, <code>O_APPEND</code> is not atomic, because the client computes the end of the file from cached state.</p>`
      },
      {
        q: `<p>Bash runs <code>cmd &gt; out.txt 2&gt;&amp;1</code>. List the system calls the shell and the child make, in order. Then explain why <code>cmd 2&gt;&amp;1 &gt; out.txt</code> leaves error messages on the terminal.</p>`,
        a: `<ol><li>The shell calls <code>fork</code>, then <code>wait4</code> (behind <code>waitpid</code>) to wait for the child.</li><li>The child calls <code>open("out.txt", O_WRONLY | O_CREAT | O_TRUNC, 0666)</code>, which returns the lowest free descriptor, say 3.</li><li><code>dup2(3, 1)</code> points standard output at the file's entry, then <code>close(3)</code>.</li><li><code>dup2(1, 2)</code> points standard error at the entry descriptor 1 now uses, the file.</li><li><code>execve("cmd", ...)</code> runs the program with descriptors 1 and 2 sharing one entry, and so one offset, so output and errors interleave in the file without overwriting each other.</li></ol><p>Redirections apply left to right. In <code>2&gt;&amp;1 &gt; out.txt</code>, <code>dup2(1, 2)</code> runs first, while descriptor 1 still refers to the terminal, so standard error is pointed at the terminal. Redirecting descriptor 1 to the file afterward doesn't change descriptor 2.</p>`
      },
      {
        q: `<p>A program creates a new file, and <code>write</code> returns 4096. The machine loses power a moment later. List everything that could keep those bytes from being readable under that name after reboot, and the call that removes each risk.</p>`,
        a: `<ul><li><strong>The data is only in the page cache.</strong> <code>write</code> copied it into a dirty page and returned. Writeback might not have run. <code>fsync(fd)</code> (or <code>fdatasync</code>) writes it out.</li><li><strong>The device's volatile write cache.</strong> An SSD may acknowledge a write once the data is in its DRAM cache. <code>fsync</code> also issues a cache flush to the device, unless the device reports a power-loss-protected cache.</li><li><strong>The file's metadata.</strong> The new size and block pointers must be on storage too, or the data is unreachable. <code>fsync</code> covers the file's own metadata, and <code>fdatasync</code> covers the size.</li><li><strong>The directory entry.</strong> The file is new, so its name lives in the directory, which is a separate inode. Without <code>fsync</code> on the directory, the file can vanish after reboot even though its data was written.</li></ul><p>A successful <code>write</code> guarantees only visibility to other processes, not durability.</p>`
      }
    ]
  }
},

{
  id: "process-syscalls",
  region: "os",
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
}
]);
