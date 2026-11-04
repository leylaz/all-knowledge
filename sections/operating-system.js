/* Section: Operating system
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "os"). */

section({
  id: "os",
  name: "Operating System",
  cap: "Privilege levels, faults, traps, kernel entry, context switching, scheduling, locks, futexes, RCU, deadlock, priority inversion, demand paging, page replacement, copy-on-write, mmap, file and process system calls, the I/O path, interrupts and DMA, NAPI, blk-mq, io_uring, kernel bypass",
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
  id: "privilege-levels",
  region: "os",
  title: "Privilege Levels",
  sections: [
    { id: "why-levels", label: "Why Levels Exist" },
    { id: "ladder", label: "The Ladder on Three ISAs" },
    { id: "user", label: "User Level: Applications and Isolated Services" },
    { id: "kernel", label: "Kernel Level: Sharing One Machine" },
    { id: "hypervisor", label: "Hypervisor Level: Sharing Between Kernels" },
    { id: "firmware", label: "Firmware Level: The Platform and the Secure World" },
    { id: "unused-rings", label: "Rings 1 and 2" },
    { id: "beyond-ladder", label: "Beyond the Ladder" },
    { id: "cost", label: "The Cost of Crossing" }
  ],
  body: `
<p>A privilege level is a few bits of core state that decide what the running code may do. Each level exists because some piece of software has to be protected from the code below it, and has to control something the code below it can't be trusted with. This page goes up the ladder and asks, for each level, what it protects and what runs there in practice. How a trap moves between levels is in <a href="#/exceptions/trap-target">Which Mode Handles the Trap</a>. Main sources: Hennessy and Patterson (chapter 2 on virtual machines and protection), the Intel SDM volume 3, the Arm Architecture Reference Manual for A-profile, the RISC-V privileged specification, and Swift et al., "Improving the Reliability of Commodity Operating Systems" (SOSP 2003).</p>

<h3 id="sec-why-levels">Why Levels Exist</h3>
<p>A level is useful only if the hardware enforces three things for it:</p>
<ul>
<li><strong>Instructions:</strong> some instructions fault below a given level, such as loading the page-table base, masking interrupts, or configuring the levels themselves.</li>
<li><strong>Memory:</strong> page-table permissions, second-stage tables, and physical memory protection decide which addresses a level can reach.</li>
<li><strong>Control transfer:</strong> code can enter a higher level only through a trap to an entry point that level chose, and it gets back only through a return instruction.</li>
</ul>
<p>Together these make a higher level's code and data safe from everything below it, which is what makes it possible to trust it with a shared resource. Every level up the ladder exists for the same reason: there is something more than one lower-level program shares, and someone has to arbitrate it. Processes share a machine, so the kernel arbitrates. Kernels share a machine in a cloud, so the hypervisor arbitrates. Everything shares the platform itself (power, flash, the boot chain, and on Arm the secure memory), so the firmware arbitrates.</p>

<h3 id="sec-ladder">The Ladder on Three ISAs</h3>
<div class="tbl"><table>
<tr><th>Level</th><th>x86-64</th><th>Arm64</th><th>RISC-V</th><th>Typical software</th></tr>
<tr><td>User</td><td>Ring 3</td><td>EL0</td><td>U</td><td>Applications, browser renderers, user-space drivers and file systems</td></tr>
<tr><td>Kernel</td><td>Ring 0</td><td>EL1</td><td>S (VS for a guest)</td><td>Linux, Windows, XNU, a guest kernel</td></tr>
<tr><td>Hypervisor</td><td>VMX root operation</td><td>EL2</td><td>HS (hypervisor extension)</td><td>KVM, Xen, Hyper-V, pKVM</td></tr>
<tr><td>Firmware</td><td>System Management Mode</td><td>EL3</td><td>M</td><td>UEFI SMM handlers, Trusted Firmware-A, OpenSBI</td></tr>
</table></div>
<p>The hardware enforces the ladder, but software decides which rungs it uses. A phone without virtualization runs nothing at EL2, an embedded RISC-V microcontroller may have only M and U modes, and many x86 systems have no hypervisor at all. The levels below are described by what they are for, not by which ISA names them.</p>

<h3 id="sec-user">User Level: Applications and Isolated Services</h3>
<p>The user level is where code runs when nothing about it needs to be trusted. It can compute and touch its own memory, and everything else (files, the network, devices, and other processes) goes through a system call. That is the point: a bug or an attacker here can damage only the one process, and the kernel cleans up after it exits.</p>
<p>Because user level is the safe place for a crash, systems keep moving code down to it:</p>
<ul>
<li><strong>Sandboxed parts of applications:</strong> Chrome runs each site's renderer in its own user process and further restricts it with seccomp-bpf, which filters the system calls it may make. A renderer exploit then still needs a second bug to escape.</li>
<li><strong>Microkernel services:</strong> seL4, QNX, and MINIX 3 run drivers, file systems, and the network stack as user processes that talk through IPC. A crashed driver is restarted instead of taking the machine down.</li>
<li><strong>User-space file systems:</strong> FUSE lets sshfs or a cloud-storage client be an ordinary program, with the kernel forwarding requests to it.</li>
<li><strong>User-space drivers for speed:</strong> DPDK (network) and SPDK (storage) map a device's registers into a process through VFIO and poll it, so an I/O costs no system call and no interrupt. The IOMMU keeps the device's DMA inside that process's memory, which is what makes it safe to hand a device to user code.</li>
</ul>

<h3 id="sec-kernel">Kernel Level: Sharing One Machine</h3>
<p>The kernel level exists to multiplex the machine between processes that don't trust each other. It is needed for exactly the operations that would let one process reach another:</p>
<ul>
<li><strong>Address translation:</strong> only the kernel writes page tables and the page-table base (CR3, TTBR0_EL1, <code>satp</code>). If user code could, it could map any physical page, including another process's.</li>
<li><strong>Interrupts and the timer:</strong> only the kernel can mask interrupts and program the timer, which is what lets it take the core back from a process that never yields (see <a href="#/context-switch">Context Switching</a>).</li>
<li><strong>Devices and DMA:</strong> a device that can DMA can write any physical address, so programming one is as powerful as writing page tables. Without an IOMMU it must stay in the kernel.</li>
<li><strong>Naming and permissions:</strong> files, sockets, and process IDs are kernel objects, so the kernel can check every access against the caller's identity.</li>
</ul>
<p>The catch is that everything at kernel level is trusted equally, and a monolithic kernel puts a lot there. Linux runs every driver in ring 0, and drivers are most of its code. Swift et al. found that drivers caused 85% of recently reported Windows XP failures. Because a driver bug is a kernel bug, the trend has been to shrink what runs at this level: eBPF lets user programs load code into the kernel only after a verifier proves it safe, and Windows moved most of its display driver out of the kernel in Vista, so a GPU driver crash restarts the driver instead of the machine.</p>

<h3 id="sec-hypervisor">Hypervisor Level: Sharing Between Kernels</h3>
<p>A kernel assumes it owns the page tables, the interrupt controller, and physical memory. To run several kernels on one machine, something above them has to give each one the illusion and keep them apart. That is the hypervisor's first use (see <a href="#/virtualization">Virtualization</a>):</p>
<ul>
<li><strong>Cloud servers:</strong> AWS's Nitro hypervisor (based on KVM), Azure's Hyper-V, and Google's KVM split one server among tenants who must not see each other. The second-stage page table (EPT, Arm stage 2, RISC-V G-stage) lets each guest kernel write its own page tables freely, while the hypervisor alone decides which physical memory each guest can reach.</li>
<li><strong>Consolidation and migration:</strong> a guest is a set of memory pages and register state, so it can be paused, snapshotted, and moved to another host while running.</li>
</ul>
<p>The second use matters more on clients and phones: the hypervisor protects parts of a single system from its own kernel. The kernel can't change second-stage permissions, so a hypervisor can keep memory away from a kernel even after an attacker takes the kernel over:</p>
<ul>
<li><strong>Windows virtualization-based security (VBS):</strong> Hyper-V runs the normal Windows kernel in Virtual Trust Level 0 and a small secure kernel in VTL 1. Credential Guard keeps password hashes and Kerberos tickets in a VTL 1 process, so an attacker with ring 0 in VTL 0 still can't read them. Hypervisor-protected code integrity (HVCI) uses the second-stage table to make kernel pages executable only after the secure kernel has checked their signature, so injected kernel code can't run.</li>
<li><strong>Android pKVM:</strong> on recent Pixel phones, a small hypervisor at EL2 removes the Android kernel's access to the memory of protected VMs. Those VMs run sensitive work, such as Android's isolated compilation of system code, that stays private and unmodified even if the Android kernel is compromised.</li>
</ul>

<h3 id="sec-firmware">Firmware Level: The Platform and the Secure World</h3>
<p>The firmware level is for code that has to work no matter which OS runs, or has to be trusted even when the OS and the hypervisor aren't. It boots the machine, and then stays resident for jobs that are specific to the board:</p>
<ul>
<li><strong>x86 System Management Mode:</strong>
<ul>
<li><strong>Protecting the firmware flash:</strong> the chipset can allow writes to the SPI flash only from SMM, so malware in ring 0 can't rewrite the firmware. UEFI variable writes go through an SMM handler for the same reason.</li>
<li><strong>Platform events and errors:</strong> ACPI events from the board, and "firmware-first" handling of memory errors, where firmware logs and decodes a machine check before the OS sees it.</li>
<li><strong>Legacy emulation:</strong> making a USB keyboard look like a PS/2 one to a boot loader or an old OS.</li>
</ul></li>
<li><strong>Arm EL3 (Trusted Firmware-A):</strong>
<ul>
<li><strong>Power control through PSCI:</strong> turning cores on and off and resetting the system, so one Linux image can boot on many boards.</li>
<li><strong>The world switch:</strong> EL3 moves the core between the Non-secure world and the Secure world of TrustZone, whose memory the Non-secure world can't read at any level. A trusted OS there (OP-TEE, Trusty, or a vendor TEE) holds keys, matches fingerprints, and runs the Widevine L1 DRM path, so a fully compromised Android kernel still can't extract them.</li>
</ul></li>
<li><strong>RISC-V machine mode (OpenSBI):</strong>
<ul>
<li><strong>Services the kernel can't reach:</strong> the timer on cores without the Sstc extension, IPIs, starting and stopping harts, and system reset, through SBI calls.</li>
<li><strong>Emulating what the hardware lacks:</strong> misaligned accesses and missing CSRs, so one kernel runs on cores that differ.</li>
<li><strong>Enforcing isolation with PMP:</strong> machine mode is the only mode that programs physical memory protection, which is what the Keystone enclave framework builds on.</li>
</ul></li>
</ul>
<p>The price of this level is that it is invisible to the OS. Time spent in SMM is stolen from whatever was running, and on most platforms every core enters SMM together, so a long SMI handler stalls the whole machine. Firmware is also hard to update and audit, and bugs in SMM handlers have been some of the most serious x86 vulnerabilities, because code at this level can read and write all memory.</p>

<h3 id="sec-unused-rings">Rings 1 and 2</h3>
<p>The ladder doesn't need every level the hardware offers. x86 inherited four rings from the idea in Multics, which had eight, but almost nothing uses rings 1 and 2:</p>
<ul>
<li><strong>Paging sees only two levels:</strong> a page is either user or supervisor, and code in rings 0, 1, and 2 all count as supervisor, so a ring-1 driver could still overwrite kernel memory.</li>
<li><strong>Portability:</strong> most other ISAs had two levels below the hypervisor, and Linux and Windows run on many of them.</li>
<li><strong>Every crossing costs a trap:</strong> a ring-1 driver would pay a privilege switch on each call into the ring-0 kernel.</li>
</ul>
<p>They did find uses. OS/2 ran device-access code in ring 2. Before VT-x, VMware's binary translator and 32-bit Xen paravirtualized guests ran the guest kernel in ring 1, so the hypervisor in ring 0 stayed protected from it. On x86-64 segment limits are gone, so 64-bit Xen guests run their kernels in ring 3 instead, and hardware virtualization later replaced these tricks.</p>

<h3 id="sec-beyond-ladder">Beyond the Ladder</h3>
<p>The ladder assumes each level trusts everything above it. Newer hardware breaks that assumption, because a cloud tenant doesn't want to trust the cloud's hypervisor:</p>
<ul>
<li><strong>Intel SGX:</strong> an enclave runs at user level, but its memory is encrypted and the core blocks the kernel, the hypervisor, and SMM from reading it. Intel has dropped it from client cores but kept it on Xeons.</li>
<li><strong>Confidential VMs:</strong> AMD SEV-SNP, Intel TDX, and Arm CCA encrypt a guest's memory and check its integrity in hardware, so the hypervisor still schedules the guest but can't read or change its memory. Each adds a small trusted component the hypervisor can't touch: AMD's security processor, Intel's TDX module running in a new SEAM mode, and on Arm a Realm Management Monitor in a new Realm world.</li>
<li><strong>Separate processors:</strong> the Intel Management Engine and AMD's Platform Security Processor are separate cores on the chip with their own firmware, sometimes called "ring −3". They are not a privilege level of the main core, but they can reach its memory.</li>
</ul>
<p>So "more privileged" now has two meanings: what a level controls (scheduling, memory allocation) and what it can see. Confidential computing gives the hypervisor the first without the second.</p>

<h3 id="sec-cost">The Cost of Crossing</h3>
<p>Each crossing flushes the pipeline and runs code with colder caches and predictors, and the cost grows with the distance:</p>
<div class="tbl"><table>
<tr><th>Crossing</th><th>Typical round trip</th><th>Main costs</th></tr>
<tr><td>User to kernel (system call)</td><td>About 100 ns, several hundred with Meltdown mitigations on older cores</td><td>Pipeline flush, entry and exit code, page-table switch with KPTI</td></tr>
<tr><td>Guest to hypervisor (VM exit)</td><td>About 1 µs, more if the host kernel or user-space emulator gets involved</td><td>Saving and loading the guest's state in the VMCS, the exit handler</td></tr>
<tr><td>Non-secure to Secure world (Arm <code>smc</code> to a TEE)</td><td>A few µs</td><td>Saving the Non-secure context in EL3, the trusted OS's own entry</td></tr>
<tr><td>Anything to SMM (SMI)</td><td>Tens to hundreds of µs, on every core at once</td><td>Saving all cores' state to SMRAM, rendezvous of all cores, the handler</td></tr>
</table></div>
<p>This is why every design tries to keep the common case on one level: the vDSO answers <code>clock_gettime</code> without entering the kernel, posted interrupts deliver a device interrupt to a guest without a VM exit, and the Sstc extension lets a RISC-V kernel program its own timer without an SBI call.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>An nginx worker on a 3.0 GHz Ice Lake server core makes 250,000 system calls per second. Each round trip costs 70 ns without kernel page-table isolation (KPTI) and 180 ns with it. What fraction of the core goes to crossing in each case?</p>`,
        a: `<ol><li>Without KPTI: 250,000 × 70 ns = 17.5 ms per second, so <strong>1.75%</strong> of the core.</li><li>With KPTI: 250,000 × 180 ns = 45 ms per second, so <strong>4.5%</strong>.</li><li>KPTI costs 2.75 points of the core here. A worker that made ten times as many calls would lose a quarter of the core with KPTI, which is why servers batch calls (<code>io_uring</code>, <code>sendmmsg</code>) and why Ice Lake, which isn't vulnerable to Meltdown, runs without KPTI.</li></ol>`
      },
      {
        q: `<p>A storage server reads from a Samsung PM1733 NVMe SSD at 1.5 million 4 KB reads per second. Through the kernel, each read costs one system call (200 ns) and one completion interrupt (600 ns of entry, handling, and exit). SPDK instead runs the driver in user space and polls the completion queue on one dedicated core. How many cores does the kernel path spend on crossing alone, and when is SPDK's choice worse?</p>`,
        a: `<ol><li>Crossing cost per read = 200 + 600 = 800 ns.</li><li>At 1.5 × 10<sup>6</sup> reads per second, that is 1.5 × 10<sup>6</sup> × 800 ns = 1.2 s of CPU time per second, so <strong>1.2 cores</strong> spent only on entering and leaving the kernel.</li><li>SPDK spends <strong>exactly 1 core</strong>, always, because the polling loop runs whether or not I/O arrives.</li><li>At full load SPDK wins by 0.2 cores, and it also cuts latency because no interrupt is taken. At 10% load, the kernel path costs only 0.12 cores while SPDK still burns 1, so <strong>polling is worse at low or bursty load</strong>. That is why the kernel itself switches to polling only under high load (NAPI for networks, <code>io_uring</code>'s polled mode for storage).</li></ol>`
      },
      {
        q: `<p>A motor controller on an x86 industrial PC runs a control loop every 100 µs. Reading MSR_SMI_COUNT twice, an hour apart, gives a difference of 3600, and an oscilloscope on a GPIO toggled by the loop shows each SMI stalls the core for 120 µs. SMIs arrive at random times relative to the loop. How many loop deadlines are missed per hour?</p>`,
        a: `<ol><li>SMIs per second = 3600 / 3600 s = 1.</li><li>A loop iteration misses its deadline if its start time falls inside an SMI. Starts are 100 µs apart, so a 120 µs window at a random offset covers 120 / 100 = <strong>1.2 starts on average</strong>: always at least 1, and 2 when the window begins within the last 20 µs before a start, which happens 20% of the time.</li><li>Missed deadlines per hour = 3600 × 1.2 = <strong>4320</strong>.</li><li>The OS can't mask an SMI or see it, so the fix is in firmware: disable the SMI sources the board doesn't need (legacy USB emulation is a common one), or pick a platform whose vendor certifies short SMIs for real-time use.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>x86 has four rings, but Linux and Windows use only rings 0 and 3. Why, and what does that cost a design that wants to isolate drivers from the core kernel?</p>`,
        a: `<ul><li><strong>Paging distinguishes only two levels.</strong> Code in rings 0, 1, and 2 all count as supervisor, so a driver in ring 1 could still write kernel pages, and the extra ring buys no memory isolation.</li><li><strong>Portability.</strong> The same kernels run on ISAs with two levels below the hypervisor, so their design assumes two.</li><li><strong>The cost for driver isolation:</strong> a kernel that wants it has to move drivers all the way to ring 3, as microkernels do, and give each its own address space. Every driver call then becomes an IPC with two privilege crossings and an address-space switch. Alternatives that avoid the switch are software isolation (eBPF's verifier) or hardware domains inside ring 0, such as Intel's protection keys for supervisor pages (PKS).</li></ul>`
      },
      {
        q: `<p>Windows HVCI checks the signature of kernel code in a secure kernel that runs under Hyper-V, rather than in the Windows kernel itself. An attacker already has arbitrary read and write in the Windows kernel. Why does the hypervisor-based check still stop them from running injected code?</p>`,
        a: `<ul><li><strong>Ring 0 controls the guest page tables, not the second-stage table.</strong> The attacker can mark a page executable in the Windows kernel's own page table, but the core also checks the second-stage (EPT) permissions, which only the hypervisor writes.</li><li><strong>The secure kernel decides those permissions.</strong> A page becomes executable in the second-stage table only after the secure kernel in VTL 1 has verified its signature, and writable and executable are never granted together.</li><li><strong>VTL 1's memory is outside VTL 0's reach.</strong> The attacker can't patch the secure kernel or its policy, because the hypervisor doesn't map that memory into VTL 0 at all.</li><li><strong>What remains:</strong> the attacker can still corrupt kernel data and reuse existing signed code, so HVCI raises the bar rather than ending kernel exploitation.</li></ul>`
      },
      {
        q: `<p>On a RISC-V core without the Sstc extension, Linux programs its next timer tick with an SBI call. Trace one timer tick from the kernel setting the deadline to the kernel's handler running, counting the crossings into machine mode. What does Sstc change, and how does Arm avoid the problem?</p>`,
        a: `<ol><li><strong>Set the deadline:</strong> the kernel runs <code>ecall</code> (SBI set_timer). It traps to machine mode (crossing 1), OpenSBI writes <code>mtimecmp</code>, clears any pending supervisor timer interrupt, and returns with <code>mret</code>.</li><li><strong>The deadline passes:</strong> the machine timer interrupt fires. It isn't delegated, so it traps to machine mode (crossing 2). OpenSBI masks it and sets STIP, the supervisor timer interrupt pending bit, then returns.</li><li><strong>The kernel's handler runs:</strong> the pending supervisor timer interrupt is delegated, so the core traps into supervisor mode and the kernel handles the tick.</li></ol><p>That is <strong>2 machine-mode round trips per tick</strong>. Sstc adds a <code>stimecmp</code> CSR that supervisor mode writes directly, and the comparison raises the supervisor timer interrupt itself, so the tick needs no machine mode at all. Arm had this from the start: the generic timer's compare registers, such as CNTV_CVAL_EL0, which EL1 can always write, let the kernel set its own deadline, and the interrupt goes through the GIC straight to EL1.</p>`
      },
      {
        q: `<p>A cached-file <code>read</code> on a monolithic kernel costs one system call round trip. On a microkernel where the file system is a user-level server, count the privilege crossings and address-space switches for the same read, and name two techniques that keep microkernels competitive.</p>`,
        a: `<ul><li><strong>Monolithic:</strong> 2 crossings (enter and exit the kernel), no address-space switch.</li><li><strong>Microkernel:</strong> the application's IPC send enters the kernel (1), the kernel switches to the file server's address space and returns into it (2), the server's reply enters the kernel (3), and the kernel switches back and returns to the application (4). That is <strong>4 crossings and 2 address-space switches</strong>, plus the server's work.</li><li><strong>Fast IPC paths:</strong> seL4 and L4 pass short messages in registers and switch directly to the receiver without going through the scheduler, so one IPC costs a few hundred cycles.</li><li><strong>Tagged TLBs:</strong> address-space IDs (PCID on x86, ASID on Arm and RISC-V) mean the switches don't flush the TLB, so the server's and application's translations survive.</li><li><strong>Shared memory for data:</strong> the file contents go through a page mapped into both, so only the request and reply travel by IPC.</li></ul>`
      },
      {
        q: `<p>Why does an SMI usually stop every core, not just the one that received it, and why can't the kernel mask SMIs the way it masks device interrupts?</p>`,
        a: `<ul><li><strong>Every core stops so the handler sees a quiet machine.</strong> SMM handlers change platform state, such as flash, memory-controller settings, and error registers, that other cores could be using. If one core sat in SMM while others ran the OS, the OS could see half-updated hardware, or an attacker on another core could change memory the handler is about to trust. Firmware therefore broadcasts the SMI and waits until all cores have entered SMM before it runs the handler.</li><li><strong>The kernel can't mask SMIs by design.</strong> The SMI is a separate pin and message type that IF, the APIC's task priority, and every other OS-visible mask ignore. Its purpose is for firmware to keep control of the platform, such as protecting the flash and handling hardware errors, even against a compromised kernel, so letting the kernel mask it would defeat that.</li><li><strong>Consequence for performance work:</strong> SMI time looks like the core silently ran slower. On Intel cores MSR_SMI_COUNT, shown by <code>turbostat</code>, is the way to see it.</li></ul>`
      }
    ]
  }
},

{
  id: "exceptions",
  region: "os",
  title: "Faults, Traps, Interrupts, and System Calls",
  sections: [
    { id: "privilege-levels", label: "Privilege Levels" },
    { id: "out-order-core", label: "Making the Exception Precise" },
    { id: "trap-target", label: "Which Mode Handles the Trap" },
    { id: "hardware-sequence", label: "The Hardware Sequence" },
    { id: "vectors", label: "Vectors and the Interrupt Descriptor Table" },
    { id: "trap-frame", label: "The Handler and the Trap Frame" },
    { id: "return", label: "Returning to User Mode" },
    { id: "system-calls", label: "System Calls" },
    { id: "performance-trade-offs", label: "Performance Trade-Offs" },
    { id: "common-events", label: "Reference: Common Events" }
  ],
  body: `
<p>User code can't touch the page tables, the devices, or other processes. The only way into the kernel is for the core itself to transfer control there, to an address the kernel chose in advance. Four kinds of event do that. They differ in what causes them and where execution resumes. Main sources: Hennessy and Patterson (appendix C on exceptions in pipelines, and chapter 3 on reorder buffers), Bryant and O’Hallaron chapter 8, the RISC-V privileged specification, the Intel SDM volume 3, and the Arm Architecture Reference Manual for A-profile.</p>
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
<p>x86 has rings 0–3 (kernel in 0, user in 3). ARM has exception levels EL0 (user), EL1 (kernel), EL2 (hypervisor), and EL3 (secure monitor). RISC-V has user, supervisor, and machine modes. No instruction raises privilege directly. Privilege goes up only through an exception entry, which always lands on a handler the kernel installed, and comes down only through an exception-return instruction. What each level is used for is in <a href="#/privilege-levels">Privilege Levels</a>.</p>

<h3 id="sec-out-order-core">Making the Exception Precise</h3>
<p>Hennessy and Patterson call an exception <strong>precise</strong> if the core stops so that every instruction before the faulting one has completed, and neither the faulting instruction nor anything after it has changed architectural state. The handler can then fix the cause and restart from one PC as if nothing had happened. An out-of-order core finishes instructions out of order, so it gets this property from the reorder buffer:</p>
<ol>
<li><strong>Detect:</strong> the unit that finds the problem writes an exception code into the instruction's ROB entry, plus the faulting address if there is one. That unit is decode for an illegal opcode, the TLB or page walker for a page fault, and the divider for a divide error. Nothing else happens yet.</li>
<li><strong>Wait:</strong> the instruction may be on a mispredicted path. If an older branch turns out to be mispredicted, the flush removes the faulting entry and the exception never happened. Meanwhile, younger instructions keep executing speculatively, which is the window Meltdown exploited.</li>
<li><strong>Take it at the head:</strong> when the entry reaches the ROB head, every older instruction has committed. The core flushes the ROB, the issue queues, and the load and store queues, and restores the rename map from the committed (retirement) map. Stores that already committed and sit in the store buffer still drain to memory, since they are architectural. Then the front end is redirected to the handler. How each structure is cleared and restored is in <a href="#/flush-recovery/exceptions">Pipeline Flush and Recovery</a>.</li>
</ol>
<p>Because exceptions are taken in commit order, the oldest one always wins, even if a younger instruction detected its fault first. An interrupt has no faulting instruction, so the core chooses a boundary: it flushes everything uncommitted and saves the PC of the oldest uncommitted instruction as the resume point. Flushing keeps interrupt latency short but throws away the work in flight, which in a 512-entry ROB (Intel's Golden Cove) can be hundreds of instructions that are fetched again after the handler. See <a href="#/rob">Reorder buffer</a>.</p>

<h3 id="sec-trap-target">Which Mode Handles the Trap</h3>
<h4 id="sec-trap-target-x86">x86-64</h4>
<p>x86-64 has four privilege levels in hardware, rings 0–3, held as the current privilege level (CPL) in the low 2 bits of CS. Linux and Windows use only two of them: ring 3 for applications and ring 0 for the kernel. Rings 1 and 2 still exist, but paging only separates ring 3 from the rest, so code in ring 1 or 2 could touch kernel pages, and nothing uses them. Two more levels sit outside the rings, which is why they are informally called "ring −1" and "ring −2". From least to most privileged:</p>
<ul>
<li><strong>Ring 3:</strong> applications.</li>
<li><strong>Ring 0:</strong> the operating system kernel.</li>
<li><strong>VMX root operation:</strong> the hypervisor. Intel VT-x splits the core into root and non-root operation. A guest runs in non-root operation with its own rings 0–3, so a guest kernel really is in ring 0, but chosen events leave the guest with a VM exit (see <a href="#/virtualization/hw-support">Hardware Support: Root and Non-Root Mode</a>).</li>
<li><strong>System Management Mode (SMM):</strong> firmware. It is entered only through a system management interrupt (SMI), which the chipset raises for platform events or when software writes I/O port 0xB2. The core saves its state into SMRAM, a region of DRAM that the chipset hides from every other mode, and runs the UEFI firmware's handler there until <code>rsm</code>. The firmware stays resident below the OS for the life of the system, and the OS can't see, mask, or block it.</li>
</ul>
<p>Two rules hold on every ISA in this section:</p>
<ul>
<li><strong>A trap never goes down:</strong> it is taken in the level where it happened or a more privileged one, never a less privileged one.</li>
<li><strong>The level above decides:</strong> which level takes a given trap is set by software at a more privileged level, normally once at boot.</li>
</ul>
<p>On every ISA, code also asks the level above it for a service the same way: with a dedicated instruction that does nothing except trap into that level, at an entry point the level chose in advance, with the call number and arguments in registers. On x86-64:</p>
<ul>
<li><strong><code>syscall</code> (ring 3 to ring 0):</strong> a system call, with the call number in rax (see <a href="#/exceptions/system-calls">System Calls</a>).</li>
<li><strong><code>vmcall</code> (guest to hypervisor):</strong> a hypercall. In non-root operation it always causes a VM exit (exit reason 18). Under KVM the hypercall number is in rax, and KVM refuses calls made from guest ring 3.</li>
<li><strong>No instruction enters SMM.</strong> The port 0xB2 write is a chipset convention, not part of the ISA.</li>
</ul>
<p>x86 has no register that sends a trap to a chosen ring. Every exception and interrupt goes through the IDT (see <a href="#/exceptions/vectors">Vectors and the Interrupt Descriptor Table</a>), and Linux points every gate at a ring-0 handler, so the kernel takes it whether it happened in ring 3 or ring 0. The two levels above decide on their own:</p>
<ul>
<li><strong>The hypervisor, through the VMCS:</strong> while a guest runs, the VMCS controls decide which events leave it. The exception bitmap has one bit per vector 0 to 31, and a set bit makes that exception cause a VM exit. "External-interrupt exiting" makes every physical interrupt exit, and KVM sets it so the host keeps its own devices and timer. Some instructions always exit (<code>cpuid</code>), and others exit under a control (<code>hlt</code>, I/O, and MSR accesses through bitmaps). With EPT, KVM leaves bit 14 clear, so a guest's page fault goes straight to the guest kernel through the guest's IDT, and only an EPT violation, a miss in the hypervisor's own table, exits.</li>
<li><strong>The firmware, through SMIs:</strong> an SMI goes to SMM from every mode, ring 0 and VMX root included, and no OS setting changes that. Since the OS can't see time spent in SMM, SMIs show up as unexplained latency spikes. Intel cores count them in MSR_SMI_COUNT (0x34), which <code>turbostat</code> reports.</li>
</ul>
<p>So by default a trap stays with the kernel, and a more privileged level sets bits to pull specific events up to itself. Arm works the same way, and RISC-V the opposite way.</p>

<h4 id="sec-trap-target-arm">Arm64</h4>
<p>AArch64 calls its levels exception levels, held in PSTATE.EL. Unlike x86, the hypervisor and the firmware are ordinary levels in the same numbering, entered and left with the same exception mechanism as the kernel. From least to most privileged:</p>
<ul>
<li><strong>EL0:</strong> applications.</li>
<li><strong>EL1:</strong> the operating system kernel.</li>
<li><strong>EL2:</strong> the hypervisor.</li>
<li><strong>EL3:</strong> the secure monitor, which is firmware. It also switches the core between the Non-secure world, where Linux runs, and the Secure world, where a trusted OS such as OP-TEE runs at Secure EL1. On most systems EL3 runs the BL31 stage of Trusted Firmware-A (TF-A), the Arm counterpart of RISC-V's OpenSBI (below). It handles PSCI calls, such as CPU_ON, CPU_OFF, and SYSTEM_RESET, and the world switches. Unlike OpenSBI, it emulates nothing for the kernel: the generic timer and the GIC's system registers are accessible at EL1, so the kernel's timer and IPIs never pass through EL3.</li>
</ul>
<p>Each step up has its own instruction, and each carries a 16-bit immediate that lands in the syndrome register:</p>
<ul>
<li><strong><code>svc</code> (EL0 to EL1):</strong> a system call. Linux always uses <code>svc #0</code> and reads the call number from x8.</li>
<li><strong><code>hvc</code> (EL1 to EL2):</strong> a hypercall.</li>
<li><strong><code>smc</code> (EL1 or EL2 to EL3):</strong> a firmware call, following the SMC Calling Convention, with the function ID in w0. PSCI CPU_ON from a 64-bit caller is 0xC400_0003.</li>
</ul>
<p><code>hvc</code> and <code>smc</code> are undefined instructions at EL0, so user code can reach only the kernel. Each level that can take exceptions has its own copy of the trap registers, named with the level as a suffix:</p>
<div class="tbl"><table>
<tr><th>Job</th><th>EL3</th><th>EL2</th><th>EL1</th></tr>
<tr><td>Resume PC (exception link register)</td><td>ELR_EL3</td><td>ELR_EL2</td><td>ELR_EL1</td></tr>
<tr><td>Saved PSTATE (saved program status register)</td><td>SPSR_EL3</td><td>SPSR_EL2</td><td>SPSR_EL1</td></tr>
<tr><td>What happened (exception syndrome register)</td><td>ESR_EL3</td><td>ESR_EL2</td><td>ESR_EL1</td></tr>
<tr><td>Faulting address</td><td>FAR_EL3</td><td>FAR_EL2</td><td>FAR_EL1</td></tr>
<tr><td>Handler table base (vector base address register)</td><td>VBAR_EL3</td><td>VBAR_EL2</td><td>VBAR_EL1</td></tr>
<tr><td>Stack pointer</td><td>SP_EL3</td><td>SP_EL2</td><td>SP_EL1</td></tr>
<tr><td>Return instruction</td><td colspan="3"><code>eret</code>, which reads the copy of the level it runs in</td></tr>
</table></div>
<p>EL0 never takes an exception, so it has no copies, only SP_EL0, its own stack pointer. Separate copies mean a trap into EL2 or EL3 never overwrites the state EL1 saved for a trap it is still handling.</p>
<p>By default, an exception from EL0 or EL1 goes to EL1. Two configuration registers pull events higher:</p>
<ul>
<li><strong>HCR_EL2 (hypervisor configuration register):</strong> IMO, FMO, and AMO route physical IRQs, FIQs, and SErrors to EL2 while a guest runs at EL0 or EL1, and KVM sets all three. TSC traps the guest's <code>smc</code> to EL2. TGE (trap general exceptions) sends every exception from EL0 to EL2 instead of EL1. It exists for VHE (Armv8.1, HCR_EL2.E2H), where the host Linux kernel itself runs at EL2, so host applications trap straight into it. Translation splits the same way as on x86 with EPT: a fault on the guest's own stage-1 table goes to the guest's EL1, and a stage-2 fault, a miss in the hypervisor's table, goes to EL2.</li>
<li><strong>SCR_EL3 (secure configuration register):</strong> its IRQ, FIQ, and EA bits route IRQs, FIQs, and external aborts to EL3, and its NS bit picks the world for the levels below. TF-A leaves IRQ clear, so Linux's interrupts go to the kernel. With GICv3 it typically sets FIQ, because Secure-world interrupts arrive as FIQs while the Non-secure world runs.</li>
</ul>

<h4 id="sec-trap-target-riscv">RISC-V</h4>
<p>RISC-V has three privilege modes. From least to most privileged:</p>
<ul>
<li><strong>User mode (U):</strong> applications.</li>
<li><strong>Supervisor mode (S):</strong> the operating system kernel. It runs with virtual memory, using the page table that <code>satp</code> points at, and can manage the page tables and interrupts of the code below it.</li>
<li><strong>Machine mode (M):</strong> firmware. "Machine" names the privilege level, not machine code, since every mode runs machine code. It is the mode the core resets into and the only one with no restrictions. It uses physical addresses directly, can access every CSR (control and status register), and programs the physical memory protection (PMP) registers that keep the other two modes out of its memory. On a Linux system it runs OpenSBI, an implementation of the Supervisor Binary Interface. The boot loader starts OpenSBI before the kernel, and it stays resident to do the few jobs that need machine mode, such as programming the timer on older cores, sending inter-processor interrupts, and powering cores off.</li>
</ul>
<p>Where x86 and Arm have one call instruction per level, RISC-V uses a single one, <code>ecall</code> (environment call), for every step up. It has no operands, and the cause code of its exception records the mode it ran in: 8 from user mode, 9 from supervisor mode, and 11 from machine mode. A program's <code>ecall</code> is a system call to the kernel, with the call number in a7 (see <a href="#/exceptions/system-calls">System Calls</a>). The kernel's <code>ecall</code> is an SBI call to the firmware, with the requested service in a7 and a6.</p>
<p>Supervisor and machine mode can both handle traps, so each has its own set of trap CSRs, as each Arm exception level has its own registers. Here the mode's letter comes first, followed by the register's job, so every register exists twice:</p>
<div class="tbl"><table>
<tr><th>Job</th><th>Machine mode</th><th>Supervisor mode</th></tr>
<tr><td>Resume PC (exception program counter)</td><td><code>mepc</code></td><td><code>sepc</code></td></tr>
<tr><td>What happened</td><td><code>mcause</code></td><td><code>scause</code></td></tr>
<tr><td>Trap value: the faulting address or instruction</td><td><code>mtval</code></td><td><code>stval</code></td></tr>
<tr><td>Previous mode, saved and current interrupt enable</td><td><code>mstatus</code> MPP, MPIE, MIE</td><td><code>sstatus</code> SPP, SPIE, SIE</td></tr>
<tr><td>Handler address (trap vector)</td><td><code>mtvec</code></td><td><code>stvec</code></td></tr>
<tr><td>Scratch register for the handler's first instructions</td><td><code>mscratch</code></td><td><code>sscratch</code></td></tr>
<tr><td>Return instruction</td><td><code>mret</code></td><td><code>sret</code></td></tr>
</table></div>
<p><code>sstatus</code> isn't a separate register. It is a view of <code>mstatus</code> that shows only the supervisor fields. MPP is 2 bits wide because a trap into machine mode can come from any of the three modes, while SPP needs only 1 bit, because a trap into supervisor mode can come only from user or supervisor mode.</p>
<p>Which set a trap uses is decided by two machine-mode CSRs, both bit vectors indexed by cause code:</p>
<ul>
<li><strong><code>medeleg</code> (machine exception delegation):</strong> bit \\(i\\) set means exception code \\(i\\) is delegated.</li>
<li><strong><code>mideleg</code> (machine interrupt delegation):</strong> the same for interrupt codes.</li>
</ul>
<p>Both reset to 0, and with every bit clear, every trap from every mode goes to machine mode: the core writes <code>mepc</code>, <code>mcause</code>, <code>mtval</code>, and <code>mstatus</code>, enters machine mode, and jumps to <code>mtvec</code>. This is the reverse of x86 and Arm, where a trap stays with the kernel unless a higher level pulls it up. On RISC-V every trap goes to the firmware unless the firmware pushes it down. Setting a bit <strong>delegates</strong> that trap to supervisor mode. When a delegated trap happens in user or supervisor mode, the core runs the same sequence with the supervisor registers and jumps to <code>stvec</code>, so the kernel gets it directly and the firmware never runs. Since a trap never goes down (see <a href="#/exceptions/trap-target">x86-64</a> above), a trap in machine mode stays in machine mode whatever the bits say.</p>
<p>On a core without the hypervisor extension, OpenSBI writes <code>medeleg</code> = 0xB109 and <code>mideleg</code> = 0x222 before it starts Linux:</p>
<ul>
<li><strong>Delegated exceptions (<code>medeleg</code> bits 0, 3, 8, 12, 13, and 15):</strong> misaligned instruction fetch, breakpoint, <code>ecall</code> from user mode, and the instruction, load, and store page faults. These are the frequent ones, and they go straight to the kernel.</li>
<li><strong>Delegated interrupts (<code>mideleg</code> bits 1, 5, and 9):</strong> the supervisor software interrupt (an IPI), timer interrupt, and external interrupt.</li>
<li><strong>Kept in machine mode:</strong> <code>ecall</code> from supervisor mode (code 9), which is how an SBI call reaches the firmware. Also the illegal instruction (code 2) and the misaligned load and store (codes 4 and 6), which OpenSBI handles in software, for example a read of the <code>time</code> CSR on a core that doesn't implement it, or a misaligned load the core can't do. Anything it doesn't handle, it forwards to the kernel by doing the trap sequence in software. It copies <code>mepc</code>, <code>mcause</code>, and <code>mtval</code> into <code>sepc</code>, <code>scause</code>, and <code>stval</code>, sets SPP, SPIE, and SIE the way the hardware would, and then runs <code>mret</code> with <code>mepc</code> pointing at <code>stvec</code> and MPP set to supervisor. The kernel sees exactly what a delegated trap would have produced, only slower: an emulated misaligned load costs hundreds of cycles, against a few for one the hardware handles.</li>
</ul>

<h3 id="sec-hardware-sequence">The Hardware Sequence</h3>
<p>Once the exception is taken, the core runs a fixed sequence with no software involved. In an out-of-order core, all of it happens when the excepting instruction reaches the ROB head: the flush removes every younger instruction, the sequence runs, and only then is the front end redirected, so the handler's first instruction sees all of the change and no instruction sees half of it. On x86-64 this is the IDT delivery sequence of the Intel SDM, volume 3, chapter 6. For an exception or interrupt taken from ring 3 into ring 0 through an IDT gate (the gate's fields are in <a href="#/exceptions/vectors">Vectors and the Interrupt Descriptor Table</a>):</p>
<ol>
<li><strong>Read the gate.</strong> Every exception and interrupt arrives with a <strong>vector</strong>, an 8-bit number from 0 to 255 that identifies the event. The core uses it to index the IDT, an array in kernel memory whose 16-byte entries, called <strong>gates</strong>, each describe how to enter the handler for one vector: the handler's address, the code segment it runs in, and which stack to use. The core finds the table through the IDTR, a 10-byte register with two fields:
<ul>
<li><strong>Base (64 bits):</strong> the table's linear (virtual) address, so the core translates it through the TLB and page tables like any other kernel load. The IDT page itself is never swapped out: a gate the core cannot read would fault during delivery and escalate to a triple fault.</li>
<li><strong>Limit (16 bits):</strong> the table's size in bytes minus 1. Linux fills all 256 vectors, so its limit is 256 × 16 − 1 = 0xFFF.</li>
</ul>
Each core has its own IDTR, which the kernel loads with the privileged <code>lidt</code>, and Linux points every core at the same table. User code can read it with <code>sidt</code> unless UMIP (CR4 bit 11) is set, and Linux sets UMIP where the core supports it so user code can't learn where the table is. The gate for vector \\(v\\) sits at IDTR.base + 16 × \\(v\\), and if any of its 16 bytes lie past the limit, the core raises #GP instead of reading past the end of the table. A page fault, for example, is vector 14, so the core reads the gate 224 bytes into the table.
<div class="tbl"><svg viewBox="0 0 680 344" role="img" aria-label="How a vector selects a gate. The IDTR's base points at gate 0 of the IDT, and its limit, 0xFFF, marks the table's last byte. A page fault carries vector 14, which selects gate 14 at base plus 16 times 14, or base plus 224. Gate 14's 16 bytes hold the handler address asm_exc_page_fault, segment selector 0x10 for kernel code in ring 0, IST 0 so the stack comes from TSS.RSP0, type 0xE for a 64-bit interrupt gate, DPL 0, and P set to 1." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="idtArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="30">IDTR (one per core)</text><text x="260" y="30">IDT in kernel memory</text><text x="20" y="109">Vector from the event</text><text x="260" y="234">Last byte at base + limit</text></g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="20" y="40" width="140" height="52" rx="3"/><rect x="20" y="117" width="140" height="44" rx="3"/></g>
<line x1="20" y1="66" x2="160" y2="66" style="stroke:var(--pad);stroke-width:1"/>
<g style="fill:var(--ink);font-size:12px"><text x="30" y="57"><tspan style="font-weight:600">Base:</tspan> IDT address</text><text x="30" y="83"><tspan style="font-weight:600">Limit:</tspan> 0xFFF</text><text x="90" y="135" text-anchor="middle" style="font-weight:600">Vector 14</text></g>
<text x="90" y="151" text-anchor="middle" style="fill:var(--muted);font-size:11px">page fault (#PF)</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="260" y="40" width="150" height="22"/><rect x="260" y="62" width="150" height="22"/><rect x="260" y="106" width="150" height="22"/><rect x="260" y="150" width="150" height="22"/><rect x="260" y="194" width="150" height="22"/></g>
<rect x="260" y="128" width="150" height="22" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:2"/>
<g style="fill:var(--ink);font-size:12px"><text x="268" y="55">Gate 0</text><text x="268" y="77">Gate 1</text><text x="268" y="121">Gate 13</text><text x="268" y="143" style="font-weight:700">Gate 14</text><text x="268" y="165">Gate 15</text><text x="268" y="209">Gate 255</text></g>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)" text-anchor="end"><text x="402" y="55">+0</text><text x="402" y="77">+16</text><text x="402" y="121">+208</text><text x="402" y="143" style="fill:var(--trace);font-weight:600">+224</text><text x="402" y="165">+240</text><text x="402" y="209">+4080</text></g>
<g style="fill:var(--muted);font-size:13px" text-anchor="middle"><text x="335" y="99">⋮</text><text x="335" y="187">⋮</text></g>
<g style="stroke:var(--trace);stroke-width:1.75;fill:none"><path d="M160,53 H256" marker-end="url(#idtArrow)"/><path d="M160,139 H256" marker-end="url(#idtArrow)"/></g>
<text x="208" y="156" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">16 × 14 = 224</text>
<g style="stroke:var(--muted);stroke-width:1;stroke-dasharray:3 3;fill:none"><path d="M410,128 L456,50"/><path d="M410,150 L456,254"/></g>
<rect x="456" y="50" width="212" height="204" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<g style="stroke:var(--rule);stroke-width:1"><line x1="456" y1="84" x2="668" y2="84"/><line x1="456" y1="118" x2="668" y2="118"/><line x1="456" y1="152" x2="668" y2="152"/><line x1="456" y1="186" x2="668" y2="186"/><line x1="456" y1="220" x2="668" y2="220"/></g>
<text x="480" y="42" style="fill:var(--ink);font-size:12px;font-weight:600">Gate 14 (16 bytes)</text>
<g style="fill:var(--muted);font-size:11px"><text x="466" y="64">Handler address (bytes 0–1, 6–11)</text><text x="466" y="98">Segment selector (bytes 2–3)</text><text x="466" y="132">IST (byte 4)</text><text x="466" y="166">Type (byte 5)</text><text x="466" y="200">DPL (byte 5)</text><text x="466" y="234">P (byte 5)</text></g>
<g style="fill:var(--ink);font-size:12px"><text x="466" y="78" style="font-family:var(--mono)">asm_exc_page_fault</text><text x="466" y="112">0x10, kernel code, ring 0</text><text x="466" y="146">0: stack from TSS.RSP0</text><text x="466" y="180">0xE, 64-bit interrupt gate</text><text x="466" y="214">0: kernel only for int n</text><text x="466" y="248">1: present</text></g>
<g style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"><circle cx="208" cy="53" r="9"/><circle cx="208" cy="139" r="9"/><circle cx="467" cy="38" r="9"/><circle cx="29" cy="281" r="9"/><circle cx="29" cy="305" r="9"/><circle cx="29" cy="329" r="9"/></g>
<g style="fill:var(--trace);font-size:11px;font-weight:700" text-anchor="middle"><text x="208" y="57">1</text><text x="208" y="143">2</text><text x="467" y="42">3</text><text x="29" y="285">1</text><text x="29" y="309">2</text><text x="29" y="333">3</text></g>
<g style="fill:var(--ink);font-size:12px"><text x="46" y="285">IDTR.base gives the IDT's linear address, where gate 0 starts.</text><text x="46" y="309">The vector selects gate 14, 16 × 14 = 224 bytes past the base, which must lie within the limit.</text><text x="46" y="333">The gate gives the handler's address and how to enter it.</text></g>
</svg></div>
The core checks it:
<ul>
<li><strong>Present:</strong> the P bit must be set, or the core raises #NP.</li>
<li><strong>Type:</strong> it must be a 64-bit interrupt gate or trap gate, or the core raises #GP.</li>
<li><strong>Privilege, for <code>int n</code> and <code>int3</code> only:</strong> the gate's DPL must be at least the current CPL, or the core raises #GP. Exceptions the core raises itself and external interrupts skip this check.</li>
</ul>
The gate names a code segment. The core reads that descriptor from the GDT and checks that it is a present 64-bit code segment. Its DPL becomes the new privilege level, so Linux's <code>__KERNEL_CS</code> (selector 0x10, DPL 0) means ring 0.</li>
<li><strong>Record the cause.</strong> No register holds it. The vector is the cause, and since every vector has its own gate, the handler knows the cause from which handler is running. Two vectors add detail:
<ul>
<li><strong>CR2:</strong> a page fault writes into CR2 the linear address the access was trying to reach. That is not the address of the instruction, which is the saved RIP in step 4. Which address it is depends on the access:
<ul>
<li><strong>Load or store:</strong> the data address.</li>
<li><strong>Instruction fetch:</strong> an address on the code page that could not be fetched.</li>
<li><strong>One of the core's own accesses during delivery,</strong> such as a push onto the new stack: the address of that access. A Linux kernel stack overflow shows this. With <code>CONFIG_VMAP_STACK</code>, each kernel stack has an unmapped guard page directly below it. Deep recursion moves RSP into the guard page, and the next push faults. The core is already in ring 0, so it delivers that #PF on the same stack, and pushing the frame faults again. A page fault while delivering a page fault becomes a double fault, which Linux delivers on its own IST stack. The #DF handler reads CR2, finds the address inside the guard page, and reports a kernel stack overflow. The saved RIP alone would only point at an ordinary kernel instruction.</li>
</ul></li>
<li><strong>Error code:</strong> vectors 8, 10 to 14, 17, and 21 push a 32-bit error code, zero-extended to 8 bytes, as the last word of the frame in step 4. For #GP, #NP, and #TS it holds a segment selector or 0, and for a double fault it is always 0. For a page fault it describes the access:</li>
</ul>
<div class="tbl"><svg viewBox="0 0 680 258" role="img" aria-label="The page-fault error code. Bits 31 to 7 are 0 except bit 15, SGX. Bit 6 is SS, a shadow-stack access. Bit 5 is PK, a protection-key violation. Bit 4 is I/D, an instruction fetch. Bit 3 is RSVD, a reserved bit set in a paging entry. Bit 2 is U/S, an access from user mode. Bit 1 is W/R, a write. Bit 0 is P, 0 for a not-present page and 1 for a protection violation. Two examples: a user load from a not-present page gives 0x4, U/S set. A user store to a present read-only page gives 0x7, U/S, W/R, and P set." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="20" y="18" style="fill:var(--muted);font-size:11px">Page-fault error code (pushed as 8 bytes, upper 32 bits 0)</text>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)"><text x="24" y="42">31</text><text x="206" y="42" text-anchor="end">7</text><text x="242" y="42" text-anchor="middle">6</text><text x="306" y="42" text-anchor="middle">5</text><text x="370" y="42" text-anchor="middle">4</text><text x="434" y="42" text-anchor="middle">3</text><text x="498" y="42" text-anchor="middle">2</text><text x="562" y="42" text-anchor="middle">1</text><text x="626" y="42" text-anchor="middle">0</text></g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="20" y="50" width="190" height="36" rx="3"/><rect x="210" y="50" width="64" height="36" rx="3"/><rect x="274" y="50" width="64" height="36" rx="3"/><rect x="338" y="50" width="64" height="36" rx="3"/><rect x="402" y="50" width="64" height="36" rx="3"/><rect x="466" y="50" width="64" height="36" rx="3"/><rect x="530" y="50" width="64" height="36" rx="3"/><rect x="594" y="50" width="64" height="36" rx="3"/></g>
<g style="fill:var(--ink);font-size:12px;font-weight:600" text-anchor="middle"><text x="115" y="72">0 (bit 15: SGX)</text><text x="242" y="72">SS</text><text x="306" y="72">PK</text><text x="370" y="72">I/D</text><text x="434" y="72">RSVD</text><text x="498" y="72">U/S</text><text x="562" y="72">W/R</text><text x="626" y="72">P</text></g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle"><text x="242" y="104">shadow</text><text x="242" y="118">stack</text><text x="306" y="104">prot.</text><text x="306" y="118">key</text><text x="370" y="104">fetch</text><text x="434" y="104">reserved</text><text x="434" y="118">bit set</text><text x="498" y="104">user</text><text x="498" y="118">mode</text><text x="562" y="104">write</text><text x="626" y="104">present</text></g>
<text x="20" y="150" style="fill:var(--ink);font-size:12px">User load from a not-present page <tspan style="fill:var(--muted);font-family:var(--mono);font-size:11px">0x4</tspan></text>
<g style="stroke-width:1.5"><rect x="20" y="158" width="190" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="210" y="158" width="64" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="274" y="158" width="64" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="338" y="158" width="64" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="402" y="158" width="64" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="466" y="158" width="64" height="28" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/><rect x="530" y="158" width="64" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="594" y="158" width="64" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/></g>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="115" y="176">0</text><text x="242" y="176">0</text><text x="306" y="176">0</text><text x="370" y="176">0</text><text x="434" y="176">0</text><text x="498" y="176">1</text><text x="562" y="176">0</text><text x="626" y="176">0</text></g>
<text x="20" y="212" style="fill:var(--ink);font-size:12px">User store to a present read-only page (copy-on-write) <tspan style="fill:var(--muted);font-family:var(--mono);font-size:11px">0x7</tspan></text>
<g style="stroke-width:1.5"><rect x="20" y="220" width="190" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="210" y="220" width="64" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="274" y="220" width="64" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="338" y="220" width="64" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="402" y="220" width="64" height="28" rx="3" style="fill:var(--surface);stroke:var(--pad)"/><rect x="466" y="220" width="64" height="28" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/><rect x="530" y="220" width="64" height="28" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/><rect x="594" y="220" width="64" height="28" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/></g>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="115" y="238">0</text><text x="242" y="238">0</text><text x="306" y="238">0</text><text x="370" y="238">0</text><text x="434" y="238">0</text><text x="498" y="238">1</text><text x="562" y="238">1</text><text x="626" y="238">1</text></g>
</svg></div>
P is 0 when no valid translation exists and 1 when the page is present but the access breaks its permissions. U/S is 1 for an access made at CPL 3, and the core's own reads of the IDT, GDT, and stack during delivery count as supervisor accesses even when they come from user code.</li>
<li><strong>Switch stacks.</strong> The next step saves the interrupted state by pushing it onto a stack, a region of memory that grows downward from the address in RSP, the stack pointer register. Switching stacks means loading RSP with a different address first. When the event arrives in user mode, RSP still points at the user program's stack, and the kernel can't use it:
<ul>
<li><strong>It may be broken:</strong> user code can set RSP to anything, such as an unmapped page or a full stack, so the pushes would fault partway through delivery.</li>
<li><strong>Other threads can reach it:</strong> another thread of the same process, on another core, can read and write that memory. The handler runs C code on its stack, so another thread could read kernel data off it or overwrite a return address and take over the kernel.</li>
</ul>
So on entry from ring 3 the core moves to a stack only the kernel can reach:
<ul>
<li><strong>Where the address comes from:</strong> the TSS (Task State Segment), a small per-CPU structure the kernel fills in. In 64-bit mode it is mostly a table of stack pointers. The core finds it through the task register, as it finds the IDT through IDTR, and loads RSP from its RSP0 field, the stack for entering ring 0.</li>
<li><strong>IST stacks:</strong> the TSS also holds seven Interrupt Stack Table pointers. If the gate's IST field is nonzero, RSP comes from that entry instead, even when the core is already in ring 0. That covers events for which the current kernel stack can't be trusted. One is a double fault after a kernel stack overflow, where every push onto the old stack faults. Another is an NMI arriving in the first instructions after <code>syscall</code>, which doesn't switch RSP, so the user's RSP is briefly live in ring 0.</li>
<li><strong>Staying put:</strong> an event taken in ring 0 through a gate with IST 0 stays on the current stack, which is already a kernel stack.</li>
</ul>
<div class="tbl"><svg viewBox="0 0 680 320" role="img" aria-label="Where the new RSP comes from. The TSS, one per CPU and found through the task register, holds RSP0, RSP1, and RSP2 for rings 0 to 2, and IST1 to IST7, which Linux uses for the double fault, NMI, debug, and machine check stacks. A timer interrupt from ring 3 through a gate with IST 0 takes RSP0, which Linux points at the per-CPU entry stack, mapped in the user page tables. A double fault through a gate with IST 1 takes IST1, the per-CPU double fault stack. An NMI through a gate with IST 2 takes IST2, the per-CPU NMI stack. A page fault in ring 0 through a gate with IST 0 doesn't read the TSS and stays on the current kernel stack." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="stkArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="30">Event and its gate</text><text x="280" y="30">TSS, one per CPU (via TR)</text><text x="490" y="30">Stack RSP points at</text></g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="20" y="40" width="200" height="36" rx="3"/><rect x="20" y="124" width="200" height="36" rx="3"/><rect x="20" y="176" width="200" height="36" rx="3"/><rect x="20" y="268" width="200" height="36" rx="3"/></g>
<g style="fill:var(--ink);font-size:12px;font-weight:600"><text x="30" y="56">Timer interrupt</text><text x="30" y="140">Double fault</text><text x="30" y="192">NMI</text><text x="30" y="284">Page fault in ring 0</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="30" y="70">from ring 3, gate IST 0</text><text x="30" y="154">gate IST 1</text><text x="30" y="206">gate IST 2</text><text x="30" y="298">gate IST 0</text></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="280" y="72" width="150" height="28"/><rect x="280" y="100" width="150" height="28"/><rect x="280" y="184" width="150" height="28"/><rect x="280" y="212" width="150" height="28"/><rect x="280" y="240" width="150" height="28"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="280" y="44" width="150" height="28"/><rect x="280" y="128" width="150" height="28"/><rect x="280" y="156" width="150" height="28"/></g>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)"><text x="290" y="62" style="font-weight:600">RSP0</text><text x="290" y="90">RSP1</text><text x="290" y="118">RSP2</text><text x="290" y="146" style="font-weight:600">IST1</text><text x="290" y="174" style="font-weight:600">IST2</text><text x="290" y="202">IST3</text><text x="290" y="230">IST4</text><text x="290" y="258">IST5–7</text></g>
<g style="fill:var(--muted);font-size:11px" text-anchor="end"><text x="422" y="62">ring 0</text><text x="422" y="90">ring 1</text><text x="422" y="118">ring 2</text><text x="422" y="146">#DF</text><text x="422" y="174">NMI</text><text x="422" y="202">#DB</text><text x="422" y="230">#MC</text></g>
<g style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"><rect x="490" y="40" width="170" height="36" rx="3"/><rect x="490" y="112" width="170" height="36" rx="3"/><rect x="490" y="176" width="170" height="36" rx="3"/><rect x="490" y="268" width="170" height="36" rx="3"/></g>
<g style="fill:var(--ink);font-size:12px;font-weight:600"><text x="500" y="56">Per-CPU entry stack</text><text x="500" y="128">#DF stack</text><text x="500" y="192">NMI stack</text><text x="500" y="284">Current kernel stack</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="500" y="70">mapped in user page tables</text><text x="500" y="142">per CPU</text><text x="500" y="206">per CPU</text><text x="500" y="298">already trusted</text></g>
<g style="stroke:var(--trace);stroke-width:1.75;fill:none"><path d="M220,58 H276" marker-end="url(#stkArrow)"/><path d="M220,142 H276" marker-end="url(#stkArrow)"/><path d="M220,194 L276,170" marker-end="url(#stkArrow)"/><path d="M430,58 H486" marker-end="url(#stkArrow)"/><path d="M430,142 L486,130" marker-end="url(#stkArrow)"/><path d="M430,170 L486,194" marker-end="url(#stkArrow)"/><path d="M220,286 H486" marker-end="url(#stkArrow)"/></g>
<text x="355" y="302" text-anchor="middle" style="fill:var(--muted);font-size:11px">no stack switch, TSS not read</text>
</svg></div>
<ul>
<li><strong>Alignment and SS:</strong> the new RSP is aligned down to 16 bytes, as the calling convention expects, so the handler can call C code. SS, the stack segment register left over from segmentation, is loaded with the null selector, since 64-bit mode doesn't use it for addressing. The old SS is still pushed so <code>iretq</code> can restore it.</li>
<li><strong>Linux:</strong> RSP0 points at a small per-CPU entry stack in the CPU entry area, which stays mapped under the user page tables. The thread's own kernel stack isn't mapped there under KPTI, so the entry code switches CR3 and then moves the frame onto the thread's kernel stack.</li>
</ul>
<div class="tbl"><svg viewBox="0 0 680 380" role="img" aria-label="The frame's path in Linux for a timer interrupt from user mode. Step 1: the core loads RSP from RSP0, the top of the per-CPU entry stack, and pushes the 40-byte frame: SS 0x2b, the user RSP, RFLAGS 0x246, CS 0x33, and the user RIP. The saved RSP still points at the user stack, which is left untouched. Step 2: the entry code pushes the general registers below the frame and switches CR3 to the kernel page tables. Step 3: it copies the frame and registers, Linux's pt_regs, to the top of the thread's 16 KB kernel stack and moves RSP there, where the handler's C frames follow." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="stkArrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="30">User stack</text><text x="250" y="30">Entry stack, per CPU</text><text x="490" y="30">Thread's kernel stack, 16 KB</text></g>
<rect x="20" y="50" width="170" height="200" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<g style="stroke:var(--rule);stroke-width:1"><line x1="20" y1="110" x2="190" y2="110"/><line x1="20" y1="150" x2="190" y2="150" style="stroke:var(--muted);stroke-dasharray:3 3"/></g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle"><text x="105" y="84">older frames</text><text x="105" y="134">current function</text></g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle"><text x="105" y="168">↑ RSP before the event</text><text x="105" y="214">free</text></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="250" y="50" width="170" height="22"/><rect x="250" y="72" width="170" height="22"/><rect x="250" y="94" width="170" height="22"/><rect x="250" y="116" width="170" height="22"/><rect x="250" y="138" width="170" height="22"/><rect x="490" y="50" width="170" height="22"/><rect x="490" y="72" width="170" height="22"/><rect x="490" y="94" width="170" height="22"/><rect x="490" y="116" width="170" height="22"/><rect x="490" y="138" width="170" height="22"/></g>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)"><text x="260" y="65">SS</text><text x="260" y="87">RSP</text><text x="260" y="109">RFLAGS</text><text x="260" y="131">CS</text><text x="260" y="153">RIP</text><text x="500" y="65">SS</text><text x="500" y="87">RSP</text><text x="500" y="109">RFLAGS</text><text x="500" y="131">CS</text><text x="500" y="153">RIP</text></g>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)" text-anchor="end"><text x="412" y="65">0x2b</text><text x="412" y="87">user RSP</text><text x="412" y="109">0x246</text><text x="412" y="131">0x33</text><text x="412" y="153">user RIP</text><text x="652" y="65">0x2b</text><text x="652" y="87">user RSP</text><text x="652" y="109">0x246</text><text x="652" y="131">0x33</text><text x="652" y="153">user RIP</text></g>
<rect x="250" y="160" width="170" height="66" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5;stroke-dasharray:4 3"/>
<rect x="490" y="160" width="170" height="66" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle"><text x="335" y="190">general registers</text><text x="575" y="190">general registers</text></g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle"><text x="335" y="206">pushed by entry code</text><text x="575" y="206">copied, now pt_regs</text></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="250" y="226" width="170" height="24"/><rect x="490" y="226" width="170" height="30"/></g>
<rect x="490" y="256" width="170" height="34" style="fill:var(--surface);stroke:var(--muted);stroke-width:1;stroke-dasharray:3 3"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle"><text x="575" y="246">handler's C frames</text></g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle"><text x="335" y="242">free</text><text x="575" y="277">free</text></g>
<text x="426" y="54" style="fill:var(--trace);font-size:11px;font-weight:600">← RSP0</text>
<path d="M250,83 L194,150" style="stroke:var(--muted);stroke-width:1.25;stroke-dasharray:4 3;fill:none"/>
<path d="M424,156 H486" style="stroke:var(--trace);stroke-width:1.75;fill:none" marker-end="url(#stkArrow2)"/>
<g style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"><circle cx="230" cy="61" r="9"/><circle cx="230" cy="193" r="9"/><circle cx="455" cy="140" r="9"/><circle cx="29" cy="321" r="9"/><circle cx="29" cy="345" r="9"/><circle cx="29" cy="369" r="9"/></g>
<g style="fill:var(--trace);font-size:11px;font-weight:700" text-anchor="middle"><text x="230" y="65">1</text><text x="230" y="197">2</text><text x="455" y="144">3</text><text x="29" y="325">1</text><text x="29" y="349">2</text><text x="29" y="373">3</text></g>
<g style="fill:var(--ink);font-size:12px"><text x="46" y="325">The core loads RSP from RSP0 and pushes the 40-byte frame. Its RSP slot points at the user stack.</text><text x="46" y="349">The entry code pushes the general registers below the frame and switches CR3.</text><text x="46" y="373">It copies all of it (pt_regs) to the top of the thread's kernel stack and moves RSP there.</text></g>
</svg></div></li>
<li><strong>Push the interrupted state.</strong> Onto the new stack, 8 bytes each and in this order: the old SS, the old RSP, the old RFLAGS, the old CS, and the old RIP, then the error code if the vector has one. That is 40 bytes, or 48 with an error code, and the old SS and RSP are pushed even when the stack didn't change. The saved RIP is:
<ul>
<li><strong>Fault (#PF, #GP, #UD):</strong> the faulting instruction itself, so <code>iretq</code> re-executes it.</li>
<li><strong>Trap (#BP from <code>int3</code>, <code>int n</code>):</strong> the next instruction.</li>
<li><strong>Interrupt:</strong> the oldest uncommitted instruction, which hasn't run yet.</li>
</ul></li>
<li><strong>Update RFLAGS.</strong> With the old value saved, the core clears four flags:
<ul>
<li><strong>TF (Trap Flag, bit 8):</strong> when set, the core raises a debug exception (#DB) after every instruction, which is how a debugger single-steps. Clearing it keeps the handler from being single-stepped.</li>
<li><strong>NT (Nested Task, bit 14):</strong> set by a 32-bit hardware task switch to mark that <code>iret</code> should switch back to the previous task. 64-bit mode has no hardware task switching, and <code>iretq</code> with NT set raises #GP, so it is cleared.</li>
<li><strong>RF (Resume Flag, bit 16):</strong> when set, the core ignores an instruction breakpoint on the next instruction, so a fault on a breakpointed instruction can return to it without hitting the breakpoint again. The handler starts with breakpoints armed.</li>
<li><strong>VM (Virtual-8086 Mode, bit 17):</strong> runs 16-bit 8086 code inside 32-bit protected mode. It can't be set in 64-bit mode, and clearing it guarantees the handler runs as native code.</li>
</ul>
An interrupt gate also clears IF (Interrupt enable Flag, bit 9), which decides whether the core accepts maskable interrupts, the ones from devices and timers routed through the APIC. Linux uses interrupt gates for every vector, so every handler starts with maskable interrupts off. It must save CR2 (Control Register 2, where the core writes the faulting address on every page fault) before setting IF again, because a nested page fault would overwrite it. An NMI (Non-Maskable Interrupt, vector 2) is the one external interrupt IF can't block, used for hardware errors, watchdogs, and perf sampling. So instead, after one the core blocks further NMIs until the next <code>iretq</code>. The core doesn't clear AC (Alignment Check, bit 18). At CPL 3 with CR0.AM set, AC makes a misaligned access raise #AC. In ring 0 SMAP (Supervisor Mode Access Prevention, CR4.SMAP) reuses it: while AC is 0, a kernel access to a user page faults, and the kernel sets AC with <code>stac</code> only around deliberate copies to and from user memory. User code can leave AC set, which would open user memory to the whole handler, so Linux's entry code runs <code>clac</code> before anything else.</li>
<li><strong>Raise privilege and jump to the handler.</strong> CS is loaded with the gate's selector, which sets the CPL, the low 2 bits of CS, to 0, and RIP is loaded with the gate's 64-bit handler address. Unlike the hidden mode register of RISC-V, the CPL is readable by any code that reads CS. From the first handler instruction onward four things change:
<ul>
<li><strong>Privileged instructions become legal:</strong> moves to and from CR0, CR3, and CR4, <code>rdmsr</code> and <code>wrmsr</code>, <code>lidt</code>, <code>invlpg</code>, <code>hlt</code>, <code>swapgs</code>, and <code>sysretq</code>. At CPL 3 each of them raises #GP.</li>
<li><strong>The page permission check flips.</strong> CR3 doesn't change, so the page table is the same, but the U/S bit of each entry is now read the other way. Supervisor pages (U/S = 0), the kernel's, become accessible. User pages (U/S = 1) now fault on an instruction fetch when CR4.SMEP is set, and on a load or store when CR4.SMAP is set and RFLAGS.AC is 0. Linux sets both bits and opens user data only inside <code>copy_from_user</code> and <code>copy_to_user</code> with <code>stac</code> and <code>clac</code>, so a stray kernel dereference of a user pointer faults instead of reading whatever the user put there.</li>
<li><strong>I/O instructions become legal:</strong> <code>in</code> and <code>out</code> check CPL ≤ RFLAGS.IOPL, and Linux leaves IOPL at 0.</li>
<li><strong>Interrupt gating:</strong> maskable interrupts are now taken only while IF is 1, and the previous step just cleared it.</li>
</ul>
Fetch restarts at the handler in ring 0, translated through the same CR3. The handler sits on a supervisor page, so this fetch passes a check that the same fetch from ring 3 would fail.</li>
</ol>
<p>Unlike the RISC-V sequence, which only writes registers, this one touches memory: it reads the IDT, the GDT, and the TSS, and it writes the frame onto the new stack. Any of those accesses can fault. A page fault while delivering a page fault, or a #GP while delivering a page fault or a #GP, becomes a <strong>double fault</strong> (vector 8), which Linux sends to its own IST stack. A fault while delivering the double fault is a triple fault: the core shuts down, and the platform resets it. To keep delivery from faulting, Linux maps the IDT, GDT, TSS, and entry stacks at fixed addresses in the CPU entry area, which every page table maps, including the user page table under KPTI.</p>
<p>This is the path for every exception and interrupt. <code>syscall</code> skips it: there is no gate, no stack switch, and nothing is pushed. It saves RIP in rcx and RFLAGS in r11, clears the RFLAGS bits set in the IA32_FMASK MSR, loads CS and SS from fixed selectors in IA32_STAR, and jumps to the address in IA32_LSTAR at CPL 0 (see <a href="#/exceptions/system-calls">System Calls</a>). FRED, on newer Intel cores, replaces IDT delivery with a different sequence (see <a href="#/exceptions/vectors">Vectors and the Interrupt Descriptor Table</a>).</p>
<p>For example, a user program on x86-64 Linux with 4-level paging loads from a page of a fresh anonymous mapping that it has never touched, so no PTE exists yet. The load is <code>mov rax, [rbx+8]</code> at RIP 0x40_1a3c, with rbx = 0x7f3a_5c61_2000 and RSP = 0x7ffd_3e8a_1c50. When the load reaches the ROB head, the core flushes and changes this state:</p>
<div class="tbl"><table>
<tr><th>State</th><th>Before (user code running)</th><th>After (first handler instruction)</th></tr>
<tr><td>CPL (CS bits 1:0)</td><td>3</td><td>0</td></tr>
<tr><td>CS</td><td>0x33 (<code>__USER_CS</code>)</td><td>0x10 (<code>__KERNEL_CS</code>, from the gate)</td></tr>
<tr><td>SS</td><td>0x2b (<code>__USER_DS</code>)</td><td>0 (null selector)</td></tr>
<tr><td>RIP</td><td>0x40_1a3c</td><td><code>asm_exc_page_fault</code>, from IDT entry 14</td></tr>
<tr><td>RSP</td><td>0x7ffd_3e8a_1c50</td><td>TSS.RSP0 − 48, near the top of this CPU's entry stack</td></tr>
<tr><td>RFLAGS</td><td>0x246 (IF, ZF, PF, and bit 1, which is always 1)</td><td>0x046 (IF cleared)</td></tr>
<tr><td>CR2</td><td>Left over from the last page fault</td><td>0x7f3a_5c61_2008</td></tr>
<tr><td>Frame at the new RSP, lowest address first</td><td>—</td><td>Error code 0x4, RIP 0x40_1a3c, CS 0x33, RFLAGS 0x246, RSP 0x7ffd_3e8a_1c50, SS 0x2b</td></tr>
<tr><td>rax, rbx, and the other general registers</td><td>User values</td><td>Unchanged</td></tr>
<tr><td>GS base</td><td>The user's</td><td>Unchanged</td></tr>
<tr><td>CR3</td><td>This process's page table (the user copy under KPTI)</td><td>Unchanged</td></tr>
</table></div>
<p>The last three rows matter most: the hardware moved to a kernel stack and saved just enough to return, but it saved no general registers and changed neither GS nor CR3, so the entry code runs <code>swapgs</code> to reach per-CPU data, switches CR3 to the kernel page table under KPTI, and saves the general registers itself (see <a href="#/exceptions/trap-frame">The Handler and the Trap Frame</a>). Arm and RISC-V keep the saved state in registers instead of on the stack:</p>
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
<p>When an event with vector \\(v\\) is taken, the core reads the gate at IDTR.base + 16 × \\(v\\) and runs the sequence in <a href="#/exceptions/hardware-sequence">The Hardware Sequence</a>: it switches stacks, pushes the interrupted state and any error code, and jumps to the gate's handler.</p>
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
<li><strong>Restore the general registers</strong> from the trap frame, run <code>swapgs</code> to put the user's GS base back, and drop the error code if there is one, so the five words the hardware pushed are on top of the stack.</li>
<li><strong>Execute the return instruction.</strong> <code>iretq</code> pops RIP, CS, RFLAGS, RSP, and SS in one step. The low 2 bits of the popped CS set the CPL back to 3, the popped RFLAGS restores IF, and RSP goes back to the user stack, so user code never runs with kernel privilege and the kernel never runs at a user PC. After a <code>syscall</code>, Linux usually returns with <code>sysretq</code> instead, which touches no memory: it loads RIP from rcx and RFLAGS from r11, takes CS and SS from fixed selectors in IA32_STAR, and sets the CPL to 3. The entry code restores the user RSP itself just before it.</li>
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
        a: `<ol><li>Each gate is 16 bytes, so the offset is 16 × 0xec = 0xec0, and the gate is at 0xfffffe0000000000 + 0xec0 = <strong>0xfffffe0000000ec0</strong>.</li><li><strong>No error code:</strong> only some of the architecture's exception vectors (0 to 31) push one, and an external interrupt never does. The thread was in ring 3, so the core switches stacks. The timer's gate has an IST index of 0, so it loads <strong>RSP0 from the TSS</strong>, which Linux points at this CPU's entry stack, then pushes SS, RSP, RFLAGS, CS, and RIP. The entry code then moves that frame onto the current thread's kernel stack.</li><li><strong>No.</strong> The priority class is the vector's upper 4 bits: 0xe for the timer and 0xf for the reschedule IPI. The local APIC holds an interrupt until its class is above the class in service, so the timer waits in the IRR until the IPI handler writes EOI. The interrupt gate already cleared IF as well, so even a higher class would wait until the handler re-enables interrupts.</li></ol>`
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
  region: "os",
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
  id: "io-path",
  region: "os",
  title: "The I/O Path and Device Drivers",
  sections: [
    { id: "one-io", label: "One I/O From Start to Finish" },
    { id: "msix", label: "Interrupts: MSI-X and Affinity" },
    { id: "halves", label: "Top and Bottom Halves" },
    { id: "rings", label: "DMA and Descriptor Rings" },
    { id: "iommu", label: "The IOMMU" },
    { id: "napi", label: "Interrupts vs. Polling: NAPI" },
    { id: "coalescing", label: "Interrupt Coalescing" },
    { id: "blk-mq", label: "The Block Layer and blk-mq" },
    { id: "epoll-uring", label: "Waiting for Many I/Os: epoll and io_uring" },
    { id: "bypass", label: "Kernel Bypass: DPDK and SPDK" },
    { id: "zero-copy", label: "Zero-Copy I/O" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p><a href="#/file-syscalls">File System Calls</a> covers the interface a program sees. This page follows the request below it, through the kernel's block and network layers, the driver, the device's DMA engine, and the interrupt that reports completion, and then covers the ways fast systems shorten that path: polling, batching, completion rings, kernel bypass, and zero-copy. The hardware links are in <a href="#/icx-links/pcie">PCIe</a>, and how a hypervisor hands devices to guests is in <a href="#/virtualization/io-virt">I/O and Interrupt Virtualization</a>. Main sources: Hennessy &amp; Patterson, Appendix D (storage and I/O), Arpaci-Dusseau's <em>Operating Systems: Three Easy Pieces</em> (chapters 36 and 37), Robert Love's <em>Linux Kernel Development</em> (chapters 7 and 8, on interrupts and bottom halves), Corbet, Rubini, and Kroah-Hartman's <em>Linux Device Drivers</em>, the NVMe base specification, Mogul and Ramakrishnan's receive-livelock paper, and Jens Axboe's "Efficient IO with io_uring."</p>

<h3 id="sec-one-io">One I/O From Start to Finish</h3>
<p>A 4 KiB <code>pread</code> from a file opened with <code>O_DIRECT</code> on an NVMe SSD goes through these steps on Linux:</p>
<ol>
<li><strong>System call:</strong> the thread traps into the kernel, which checks the descriptor and finds the file's block mapping (see <a href="#/exceptions/system-calls">System Calls</a>).</li>
<li><strong>Block layer:</strong> the file system builds a <code>bio</code> naming the device sectors and the memory pages, and the block layer turns it into a <code>request</code> and gives it a tag, which is also the command's ID on the device.</li>
<li><strong>Driver:</strong> the NVMe driver maps the user pages for DMA, writes a 64-byte command into a submission queue in host memory, and writes the queue's new tail index to the device's <strong>doorbell</strong> register, a PCIe posted write to memory-mapped I/O space.</li>
<li><strong>Device:</strong> the SSD reads the command from host memory by DMA, reads the NAND, and writes the 4 KiB straight into the user pages by DMA. It then writes a 16-byte completion entry into a completion queue and sends an interrupt.</li>
<li><strong>Interrupt:</strong> the handler on the chosen core reads the completion entry, ends the request, and wakes the sleeping thread. The thread runs again, the kernel unmaps the pages, and <code>pread</code> returns.</li>
</ol>
<p>On a TLC NAND drive the device takes about 70 to 90 µs, and the kernel's work adds a few microseconds. On a low-latency drive (Optane or Z-NAND, about 5 to 10 µs) those few microseconds and the wakeup become a large share, and that is what most of this page is about. The same five steps describe a network send or receive, with the network stack in place of the block layer and a NIC's descriptor rings in place of NVMe queues.</p>

<h3 id="sec-msix">Interrupts: MSI-X and Affinity</h3>
<p>Early PCI devices signaled interrupts on shared physical wires, and the kernel had to ask each driver on a line whether its device had raised it. PCIe devices use <strong>message-signaled interrupts</strong> instead: the device raises an interrupt by doing a memory write to a special address, and the write travels upstream in order with the device's earlier DMA writes. That ordering matters: by the time the core sees the interrupt, the data and completion entry it reports are already in memory.</p>
<ul>
<li><strong>MSI:</strong> up to 32 vectors per device, sharing one target address, so all of them go to the same core.</li>
<li><strong>MSI-X:</strong> up to 2,048 vectors per device function, each with its own address and data word in a table the device exposes in one of its BARs. On x86 the address selects a target local APIC (the 0xFEE00000 region) and the data word selects the vector. Each vector can therefore go to a different core, and each can be masked on its own.</li>
</ul>
<p>Modern devices have many queues and one MSI-X vector per queue, which lets the kernel give each core its own queue and its own interrupt:</p>
<ul>
<li><strong>Storage:</strong> the NVMe driver creates one queue pair per core (or per group of cores), and the kernel spreads the vectors across cores as <strong>managed interrupts</strong> whose affinity it fixes. A completion is then handled on the core that submitted the I/O, where the request's data is already in cache.</li>
<li><strong>Network:</strong> a NIC picks a receive queue for each packet by hashing its addresses and ports (<strong>receive-side scaling</strong>, RSS, usually a Toeplitz hash), so all packets of one flow reach one queue and stay in order. Each queue's vector has an affinity set in <code>/proc/irq/&lt;n&gt;/smp_affinity</code>, by hand or by the <code>irqbalance</code> daemon. Accelerated RFS goes one step further and programs the NIC to send a flow to the queue of the core where the application reading that socket runs.</li>
</ul>
<p>Where the interrupt lands is a performance choice. Handling it on the core that will consume the data keeps the data and the socket or request state in that core's caches, but it also takes cycles and cache space from whatever runs on that core. Latency-sensitive setups therefore steer interrupts away from isolated application cores (<code>irqaffinity=</code> and <code>isolcpus=</code> on the kernel command line).</p>

<h3 id="sec-halves">Top and Bottom Halves</h3>
<p>An interrupt handler runs in a context that can't sleep, and while it runs its own vector is blocked on that core and, on Linux, all of the core's interrupts are masked. Long handlers would delay every other interrupt, so drivers split the work:</p>
<ul>
<li><strong>Top half (hard IRQ handler):</strong> does only what can't wait. It acknowledges the device, reads or clears the cause, and schedules the rest. A few hundred nanoseconds to a few microseconds.</li>
<li><strong>Bottom half:</strong> runs the rest soon afterward with interrupts enabled. Linux has three kinds:
<ul>
<li><strong>Softirqs:</strong> a fixed set of ten statically defined handlers, including network receive and transmit, block completion, timers, tasklets, and RCU. A softirq raised in a handler runs on the same core as the handler returns (<code>irq_exit</code>), so the work stays where the data is. It can run on several cores at once, so it must use per-CPU data or locks, and it still can't sleep. If softirqs keep re-raising themselves for more than about 2 ms or 10 rounds, the rest is handed to the per-CPU <code>ksoftirqd</code> thread, which the scheduler treats like any other thread. That keeps a flood of packets from starving user programs entirely. Tasklets, built on a softirq, are deprecated in favor of BH workqueues (Linux 6.9).</li>
<li><strong>Threaded IRQs:</strong> <code>request_threaded_irq</code> gives the handler a kernel thread (<code>irq/&lt;n&gt;-&lt;name&gt;</code>). The top half only returns <code>IRQ_WAKE_THREAD</code>, and the thread does the rest at real-time priority 50. It can sleep and take mutexes, and its priority can be set against application threads. PREEMPT_RT forces almost every handler into a thread this way.</li>
<li><strong>Workqueues:</strong> general deferred work, run by kernel worker threads, for anything that needs to sleep, such as a firmware reset after an error.</li>
</ul></li>
</ul>
<p>Time in each part shows up in different places: <code>/proc/interrupts</code> counts hard interrupts per core and vector, <code>/proc/softirqs</code> counts softirq runs, and <code>top</code> splits CPU time into <code>hi</code> and <code>si</code>. Softirq time is charged to whatever thread happened to be running when it ran, unless it ran in <code>ksoftirqd</code>, which is one reason a CPU-bound benchmark can look slower on a busy network core with nothing in its profile to show why.</p>

<h3 id="sec-rings">DMA and Descriptor Rings</h3>
<p>The driver and device share work through <strong>descriptor rings</strong>: circular arrays in host memory, each entry describing one buffer. Neither side waits for the other on each entry. The driver produces at the tail and the device consumes at the head, and each side tells the other where it is only now and then:</p>
<ul>
<li><strong>Posting work:</strong> the driver fills descriptors with buffer addresses, lengths, and flags, then writes the new tail index to the device's doorbell register. One doorbell write can post many descriptors. The write is uncached and goes across PCIe, so drivers ring once per batch (the block layer's <code>commit_rqs</code> and the network stack's <code>xmit_more</code> exist for this), not once per descriptor.</li>
<li><strong>Doing the work:</strong> the device fetches descriptors by DMA reads, moves the data by DMA, and reports completion either by writing a status bit back into the descriptor (most NICs' "descriptor done" bit) or by writing an entry into a separate completion ring (NVMe).</li>
<li><strong>Finding completions without a register read:</strong> an MMIO read from the driver costs a full PCIe round trip, about 1 µs, during which the core stalls. So drivers poll the completion entries in memory instead. NVMe completion entries carry a <strong>phase bit</strong> that the device flips on each pass around the ring, so the driver can tell a new entry from a stale one without reading any device register.</li>
</ul>
<p>NVMe takes this furthest: up to 65,535 I/O queue pairs of up to 65,536 entries each, with 64-byte submission entries and 16-byte completion entries. A NIC typically has one receive and one transmit ring per queue, 256 to 4,096 descriptors each.</p>
<p>DMA also has to stay coherent with the CPU's caches. On x86 servers, device DMA is snooped like a core access: a DMA read sees dirty data in a core's cache, and a DMA write invalidates cached copies. Intel's Data Direct I/O (DDIO, Xeon since Sandy Bridge) goes further and writes incoming DMA data directly into the last-level cache, but only into a few of its ways (2 by default), so a core that reads the packet soon finds it in the LLC instead of DRAM. Many Arm and embedded SoCs have devices that don't snoop, and their drivers must clean or invalidate cache lines around each transfer through Linux's DMA API (<code>dma_sync_single_for_cpu</code> and <code>dma_sync_single_for_device</code>), which the same driver code gets for free as no-ops on a coherent machine.</p>

<h3 id="sec-iommu">The IOMMU</h3>
<p>A device that can DMA can write any physical address, so without help a buggy or malicious device (or a Thunderbolt peripheral plugged into a laptop) can overwrite the kernel. An <strong>IOMMU</strong> (Intel VT-d, AMD-Vi, Arm SMMU) sits between the devices and memory and translates every DMA address. The kernel gives each device, identified by its PCIe bus, device, and function number, its own I/O page table, so a device sees an I/O virtual address (IOVA) space that holds only the buffers the driver mapped for it. The IOMMU caches translations in an IOTLB, walks the I/O page tables on a miss, and blocks and reports any access outside them. It also does interrupt remapping, so a device can't forge an MSI write to another core's vector.</p>
<p>The same hardware is what makes <a href="#/virtualization/io-virt">device passthrough</a> safe: a guest's driver programs guest-physical addresses, and the IOMMU translates them with tables the hypervisor controls.</p>
<p>Protection has a cost per I/O. The Linux DMA API (<code>dma_map_page</code> and <code>dma_unmap_page</code>) maps a buffer before each transfer and unmaps it afterward, and after an unmap the stale IOTLB entry must be invalidated before the page can be safely reused:</p>
<ul>
<li><strong>Strict mode:</strong> each unmap waits for its own IOTLB invalidation, a round trip through the IOMMU's command queue of about a microsecond. Safe, but at millions of packets per second it can take more CPU than the network stack.</li>
<li><strong>Lazy (deferred) mode:</strong> unmaps go into a per-CPU flush queue, and one global invalidation covers a batch (256 entries or 10 ms on Linux). Much cheaper, but for that window a device can still reach a page the kernel may already have reused, which is a small hole in the protection. Linux defaults to lazy mode on most x86 configurations (<code>iommu.strict=</code> chooses).</li>
<li><strong>Passthrough mode:</strong> <code>iommu=pt</code> gives kernel-owned devices an identity mapping with no per-I/O work at all, keeping the IOMMU only for devices assigned to VMs or to user-space drivers.</li>
</ul>
<p>Drivers avoid most of the cost by recycling buffers that stay mapped (the network stack's <code>page_pool</code>), and IOTLB misses become their own bottleneck at 100 Gb/s and above when buffers are spread over many 4 KiB pages, which huge-page buffers fix (Neugebauer and others, 2018).</p>

<h3 id="sec-napi">Interrupts vs. Polling: NAPI</h3>
<p>An interrupt costs a fixed amount, the entry, the handler, the exit, and the caches and branch predictors it disturbs, a microsecond or more in all, whether it brings one packet or a hundred. Polling costs nothing per event but burns a core while nothing arrives. Neither wins everywhere:</p>
<ul>
<li><strong>Light load:</strong> interrupts win. The core sleeps or runs other work, and each event costs one interrupt.</li>
<li><strong>Heavy load:</strong> polling wins. With an interrupt per packet, the interrupt and softirq work runs at a higher priority than any user thread, so as the offered load rises, the core spends more and more of its time taking in packets that the application never gets to read. Delivered throughput peaks and then falls toward zero, which Mogul and Ramakrishnan (1997) named <strong>receive livelock</strong>.</li>
</ul>
<p>Linux's <strong>NAPI</strong> (the "new API," 2.6) switches between the two by itself. The first interrupt from a receive queue masks that queue's interrupt and schedules a poll in the network-receive softirq. The poll takes up to 64 packets from the ring (the NAPI weight). If it emptied the ring, it re-enables the interrupt and stops. If not, it stays scheduled and runs again. A whole softirq round is capped at <code>net.core.netdev_budget</code> (300 packets) or 2 ms, after which leftover work goes to <code>ksoftirqd</code> and has to share the core with user threads. Under overload, the ring fills, and the NIC drops further packets in hardware without costing the CPU anything, which is the fix for livelock: drop work as early as possible, before any CPU time has been spent on it.</p>
<p>Applications that want polling all the time can ask for it. Busy polling (<code>SO_BUSY_POLL</code> or <code>net.core.busy_poll</code>) lets a thread blocked in <code>recv</code> or <code>epoll_wait</code> spin on its queue's NAPI poll for up to a set number of microseconds instead of sleeping, and storage has the same option through polled NVMe queues (below).</p>

<h3 id="sec-coalescing">Interrupt Coalescing</h3>
<p><strong>Interrupt coalescing</strong> (moderation) makes the device itself wait before interrupting, so one interrupt covers several completions. A NIC raises its interrupt when either a frame count or a timer since the first unreported completion is reached (<code>ethtool -C eth0 rx-frames 32 rx-usecs 50</code>), and NVMe has the same feature with a count and a time in 100 µs units. The cost is latency: the first completion in each batch waits for the rest. Adaptive schemes (<code>adaptive-rx</code>, Linux's dynamic interrupt moderation) change the settings with the measured rate: short timers at low rates, larger batches at high ones.</p>

<details class="ex"><summary>Worked example: coalescing at high and low load</summary>
<p><strong>Question.</strong> One receive queue of a NIC is handled by one core. Assume:</p>
<ul>
<li>Each interrupt costs 2.0 µs of CPU time, however many packets it reports.</li>
<li>Each packet costs 0.5 µs of protocol processing.</li>
<li>Packets arrive evenly spaced.</li>
<li>With coalescing on, the NIC interrupts after 32 packets or 50 µs after the first unreported packet, whichever comes first.</li>
</ul>
<p>At 1.2 million packets per second, find the CPU time per second with one interrupt per packet and with coalescing, and the delay coalescing adds. Then repeat for 10,000 packets per second with coalescing.</p>
<p><strong>Solution.</strong></p>
<ol>
<li><strong>One interrupt per packet at 1.2 million per second:</strong> 1.2 &times; 10<sup>6</sup> &times; (2.0 + 0.5) µs = 3.0 s of CPU time per second. One core can't keep up: it saturates at 1 / 2.5 µs = 400,000 packets per second.</li>
<li><strong>Which coalescing limit fires:</strong> packets are 1 / 1.2 &times; 10<sup>6</sup> &asymp; 0.833 µs apart, so 32 packets span 31 &times; 0.833 &asymp; 25.8 µs, less than 50 µs. The frame count fires, so there are 1.2 &times; 10<sup>6</sup> / 32 = 37,500 interrupts per second.</li>
<li><strong>CPU with coalescing:</strong> 37,500 &times; 2.0 µs = 75 ms for interrupts plus 1.2 &times; 10<sup>6</sup> &times; 0.5 µs = 600 ms for packets, <strong>675 ms per second (67.5% of the core)</strong>.</li>
<li><strong>Added delay:</strong> packet <em>k</em> of a batch (<em>k</em> = 0 to 31) waits (31 &minus; <em>k</em>) &times; 0.833 µs, so the first waits <strong>25.8 µs</strong> and the average is 15.5 &times; 0.833 &asymp; <strong>12.9 µs</strong>.</li>
<li><strong>10,000 per second:</strong> packets are 100 µs apart, so the 50 µs timer fires before the next packet arrives. Every packet waits the full <strong>50 µs</strong> and still gets its own interrupt, so the CPU time is 10,000 &times; 2.5 µs = 25 ms per second, the same as with no coalescing.</li>
</ol>
<p>At high load, coalescing turns an impossible load into two-thirds of a core for about 13 µs of average delay. At low load it saves nothing and adds 50 µs to every packet, which is why fixed coalescing settings are wrong for at least one of the two cases and adaptive moderation exists.</p>
</details>

<h3 id="sec-blk-mq">The Block Layer and blk-mq</h3>
<p>The block layer sits between file systems and storage drivers. It collects <code>bio</code>s into requests, merges adjacent ones, optionally reorders them with an I/O scheduler, and hands them to the driver. The original design had one request queue per device, protected by one lock, which was fine for a disk doing a few hundred I/Os per second and a hard ceiling for SSDs doing a million. <strong>blk-mq</strong> (Bjørling, Axboe, Nellans, and Bonnet, 2013, the only block path since Linux 5.0) has two levels:</p>
<ul>
<li><strong>Software staging queues,</strong> one per core (or per group of cores), where requests are built, merged, and scheduled without sharing a lock with other cores.</li>
<li><strong>Hardware dispatch queues,</strong> one per device queue, each mapped to a set of cores. With an NVMe drive that has a queue pair per core, a request goes from the submitting core to that core's own device queue with no shared state on the way.</li>
</ul>
<p>Other pieces matter for performance:</p>
<ul>
<li><strong>Tags:</strong> a per-queue pool of request IDs. Its size is the queue depth, and running out of tags is how the block layer applies back pressure.</li>
<li><strong>Plugging:</strong> a thread submitting several I/Os holds them in a per-task list (<code>blk_start_plug</code> and <code>blk_finish_plug</code>), merges what it can, and sends them down together with one doorbell write.</li>
<li><strong>I/O schedulers:</strong> <code>mq-deadline</code> (bounded latency, read priority), BFQ (proportional share, for desktops and slow devices), Kyber (latency targets for fast devices), and <code>none</code>. Fast NVMe drives usually run <code>none</code>, since the drive reorders internally and any scheduler adds CPU time per I/O.</li>
<li><strong>Completion placement:</strong> if a completion is handled on a core other than the submitter, blk-mq can send an inter-processor interrupt to finish it on the submitting core (<code>rq_affinity</code>), so the waiting thread's state stays in that core's cache.</li>
<li><strong>Polled queues:</strong> NVMe can set aside queues with no interrupt at all (<code>nvme.poll_queues=</code>), whose completions the submitter finds by polling. An I/O to a 5 µs drive then skips the interrupt and the wakeup entirely, at the cost of a spinning core.</li>
</ul>

<h3 id="sec-epoll-uring">Waiting for Many I/Os: epoll and io_uring</h3>
<p>A server with thousands of connections can't block in <code>read</code> on each, so it needs a call that waits for many at once.</p>
<p><strong>Readiness: <code>select</code>, <code>poll</code>, and <code>epoll</code>.</strong> <code>select</code> and <code>poll</code> pass the whole list of descriptors on every call, so the cost grows with the number watched. <code>epoll</code> (Linux 2.6) keeps the interest list in the kernel: <code>epoll_ctl</code> adds a descriptor once, the kernel puts it on a ready list when its wait queue fires, and <code>epoll_wait</code> returns only ready descriptors. In level-triggered mode a descriptor is reported as long as it stays ready, and in edge-triggered mode only when it becomes ready, so the program must read until <code>EAGAIN</code>. Two limits remain:</p>
<ul>
<li>epoll reports readiness, not completion. Each ready socket still needs its own <code>recv</code> and <code>send</code>, so a request costs at least three system calls (its share of the <code>epoll_wait</code> plus the two transfers).</li>
<li>Regular files are always "ready," so epoll can't overlap disk reads. Linux AIO (<code>io_submit</code>) handled only <code>O_DIRECT</code> files, and even then it could block in submission.</li>
</ul>
<p><strong>Completion: io_uring</strong> (Linux 5.1, Axboe, 2019). The program and the kernel share two rings in memory mapped into the process:</p>
<ul>
<li><strong>Submission queue (SQ):</strong> the program writes 64-byte entries (SQEs), each naming an operation (read, write, send, recv, accept, open, fsync, and dozens more), its descriptor, buffer, and a user tag.</li>
<li><strong>Completion queue (CQ):</strong> the kernel writes 16-byte entries (CQEs) with the tag and the result.</li>
<li><strong>One call for many operations:</strong> <code>io_uring_enter</code> submits every new SQE and can wait for a number of completions, all in one system call. Operations that would block are completed by the driver or by kernel worker threads, so file I/O overlaps as well as sockets do.</li>
</ul>
<p>Several options remove even that call:</p>
<ul>
<li><strong>SQPOLL:</strong> a kernel thread polls the SQ and submits new entries as they appear, so a busy program makes no system calls at all, at the cost of a core the thread spins on.</li>
<li><strong>IOPOLL:</strong> completions are found by polling NVMe poll queues instead of waiting for interrupts.</li>
<li><strong>Registered files and buffers:</strong> descriptors and buffers registered once skip the per-operation descriptor lookup and page pinning.</li>
<li><strong>Multishot operations:</strong> one <code>accept</code> or <code>recv</code> SQE keeps producing completions, with receive buffers taken from a ring the program refills.</li>
</ul>
<p>With polling on both sides and registered buffers, Axboe reported more than 10 million 512-byte random reads per second from one core in 2022. Because io_uring exposes so much of the kernel to unprivileged programs, it has also had many security bugs, and Android, ChromeOS, and Docker's default seccomp profile block it.</p>

<h3 id="sec-bypass">Kernel Bypass: DPDK and SPDK</h3>
<p>Kernel bypass removes the kernel from the data path altogether. A user-space driver maps the device's registers and DMA rings into the process through VFIO (which also programs the IOMMU so the device can reach only that process's memory), and the program polls the rings itself:</p>
<ul>
<li><strong>DPDK</strong> (networking): poll-mode drivers for most NICs, packet buffers in huge pages, lockless rings between cores, and a run-to-completion model in which each dedicated core receives, processes, and transmits batches of packets in a loop. One core can forward tens of millions of small packets per second.</li>
<li><strong>SPDK</strong> (storage): a user-space, polled NVMe driver with one queue pair per core and no locks, plus a block-device layer and NVMe-over-Fabrics targets on top.</li>
</ul>
<p>The costs are what the kernel was providing: each polling core runs at 100% even when idle, the program needs its own TCP stack or file system (or none), the device can't be shared with other programs through the usual interfaces, and kernel tools such as <code>tcpdump</code>, <code>iptables</code>, and the page cache don't see the traffic. In-kernel middle grounds keep some of that: XDP runs an eBPF program in the driver on each received packet before the kernel allocates anything, and AF_XDP sockets hand raw frames to user space through shared rings while the kernel keeps the driver.</p>

<h3 id="sec-zero-copy">Zero-Copy I/O</h3>
<p>A plain <code>read</code> of a file and <code>send</code> to a socket copies each byte twice through the CPU: from the page cache into the user buffer, and from the user buffer into socket buffers. At 100 Gb/s, those copies alone take several cores and much of the memory bandwidth. Zero-copy interfaces hand the device a reference to memory that already holds the data:</p>
<ul>
<li><strong><code>sendfile</code>:</strong> sends a file's page-cache pages to a socket. The NIC's scatter-gather DMA reads them in place, and the program never touches the bytes. Web servers and CDNs (with kernel TLS, so encryption happens in the kernel or the NIC) rely on it.</li>
<li><strong><code>splice</code> and <code>vmsplice</code>:</strong> move page references between a pipe and a file or socket without copying.</li>
<li><strong><code>MSG_ZEROCOPY</code></strong> (Linux 4.14): <code>send</code> pins the user's pages and the NIC transmits from them. The program may reuse the buffer only after a completion notice arrives on the socket's error queue. Pinning and the notice cost about as much as copying a few kilobytes, so the kernel's documentation recommends it only for sends above about 10 KB. io_uring has its own zero-copy send (6.0) and receive (6.15).</li>
<li><strong><code>O_DIRECT</code> and registered buffers:</strong> storage DMA goes straight to and from user memory, skipping the page cache.</li>
</ul>
<p>Zero-copy receive is harder than zero-copy send, since the NIC writes a packet before the kernel knows which socket, and therefore which process, it belongs to. It needs header splitting and flow steering so that a flow's payloads land in buffers that belong to the right process.</p>

<h3 id="sec-perf">Performance Trade-Offs</h3>
<ul>
<li><strong>Per-I/O overhead is what limits fast devices.</strong> A device that finishes in 5 µs or a NIC delivering millions of packets per second leaves room for only a few hundred nanoseconds of CPU per event per core. System calls, interrupts, wakeups, IOMMU flushes, and copies each cost about that much, so the fast paths above remove them one by one: batching, coalescing, polling, completion rings, bypass, and zero-copy.</li>
<li><strong>Polling trades cores for latency.</strong> Every polling scheme (NAPI under load, busy polling, IOPOLL, SQPOLL, DPDK, SPDK) saves the interrupt and the wakeup by keeping a core busy even when nothing happens. That is worth it when the core would otherwise wait, and wasteful when it could run other work.</li>
<li><strong>Batching trades latency for throughput.</strong> Coalescing and large rings cut per-event cost and raise tail latency. Large rings also have a cache cost: with DDIO, data that waits in a deep ring is evicted from the LLC before the core reads it, so each packet costs DRAM traffic twice.</li>
<li><strong>Interrupts move the costs to other code.</strong> An interrupt and its softirq disturb the caches, TLBs, and branch predictors of the core they land on, and the time is charged to whatever thread was running there. A CPU benchmark that shares cores with I/O interrupts runs slower and shows lower IPC with no visible cause in its profile. Check <code>/proc/interrupts</code> and steer interrupts away from measured cores.</li>
<li><strong>Locality decides a lot.</strong> Handling a completion on the core that submitted it, and on the NUMA node where the device and its buffers live, avoids cache misses on the request state and cross-socket traffic on the data.</li>
<li><strong>For a simulator:</strong> syscall-emulation mode has no devices, drivers, or interrupts, so an I/O looks free or is not modeled at all. Studying the I/O path needs full-system simulation with device models (gem5's IDE and NVMe-like disks, its simulated NICs, or a co-simulated device), a realistic interrupt controller, and attention to DMA's cache effects, such as whether inbound writes allocate in the LLC.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix D (storage systems) · Arpaci-Dusseau and Arpaci-Dusseau, <em>Operating Systems: Three Easy Pieces</em>, Chapters 36 and 37 · Love, <em>Linux Kernel Development</em>, 3rd edition, Chapters 7 and 8 · Corbet, Rubini, and Kroah-Hartman, <em>Linux Device Drivers</em>, 3rd edition, Chapters 10 and 15 · PCI-SIG, PCI Express Base Specification (MSI and MSI-X) · NVM Express Base Specification · Mogul and Ramakrishnan, "Eliminating Receive Livelock in an Interrupt-Driven Kernel," ACM TOCS 1997 · Salim, Olsson, and Kuznetsov, "Beyond Softnet," USENIX ALS 2001 · Bjørling, Axboe, Nellans, and Bonnet, "Linux Block IO: Introducing Multi-Queue SSD Access on Multi-Core Systems," SYSTOR 2013 · Axboe, "Efficient IO with io_uring," 2019 · Peleg, Morrison, Serebrin, and Tsafrir, "Utilizing the IOMMU Scalably," USENIX ATC 2015 · Neugebauer and others, "Understanding PCIe Performance for End Host Networking," SIGCOMM 2018 · Farshin, Roozbeh, Maguire, and Kostić, "Reexamining Direct Cache Access to Optimize I/O Intensive Applications for Multi-Hundred-Gigabit Networks," USENIX ATC 2020 · Linux kernel documentation, "Scaling in the Linux Networking Stack," "NAPI," and "MSG_ZEROCOPY" · DPDK and SPDK documentation</p>`,
  practice: {
    guided: [
      {
        q: `<p>A thread does 4 KiB random reads from an NVMe SSD on one core. Assume these CPU costs:</p><ul><li>System call entry and exit: 0.15 µs per call.</li><li>Block layer and NVMe driver work: 1.2 µs per I/O.</li><li>Doorbell write: 0.25 µs, one per call that submits I/O.</li><li>Completion interrupt: 1.6 µs per I/O (no coalescing).</li><li>Putting the thread to sleep and waking it: 2.4 µs per wait.</li></ul><p>Assume the device is never the bottleneck, and count only CPU time. Find the I/Os per second one core can sustain with:</p><ol><li><code>pread</code>, one I/O per call.</li><li>io_uring, submitting 16 reads per <code>io_uring_enter</code> and sleeping once until all 16 complete.</li><li>io_uring with IOPOLL on a polled NVMe queue, 16 reads per call, where completions are found by polling, with no interrupts and no sleeping.</li></ol>`,
        a: `<ol><li><strong><code>pread</code>:</strong> each I/O pays everything once: 0.15 + 1.2 + 0.25 + 1.6 + 2.4 = 5.6 µs, so 1 / 5.6 µs &asymp; <strong>179,000</strong> I/Os per second.</li><li><strong>io_uring with interrupts:</strong> the system call, doorbell, and wait are shared by 16 I/Os: (0.15 + 0.25 + 2.4) / 16 = 2.8 / 16 = 0.175 µs. Each I/O still pays the driver work and its own interrupt: 1.2 + 1.6 = 2.8 µs. Total 2.975 µs, so &asymp; <strong>336,000</strong> per second, 1.88 times <code>pread</code>.</li><li><strong>io_uring with IOPOLL:</strong> (0.15 + 0.25) / 16 = 0.025 µs shared, plus 1.2 µs of driver work: 1.225 µs, so &asymp; <strong>816,000</strong> per second, 4.57 times <code>pread</code>.</li><li>Batching removed the per-call costs, but the per-I/O interrupt was then the largest remaining cost (1.6 of 2.975 µs). Polling removes it, at the price of a core that stays busy even when no I/O is outstanding.</li></ol>`
      },
      {
        q: `<p>A 50 GbE NIC delivers 4.0 million packets per second, spread evenly over 8 receive queues, each handled by its own core. Every packet buffer is a 4 KiB page that the driver maps through the IOMMU before the NIC writes it and unmaps after the packet is processed. Assume:</p><ul><li>A map costs 0.15 µs of CPU time.</li><li>An unmap costs 0.10 µs, plus the IOTLB invalidation.</li><li>Strict mode: each unmap waits for its own invalidation, 1.0 µs.</li><li>Lazy mode: each core queues its unmaps, and one 2.5 µs global invalidation covers every 256 of them (Linux's flush-queue size).</li></ul><p>Find the CPU cores spent on IOMMU work in each mode, and how long a stale translation can survive in lazy mode. What do real drivers do instead?</p>`,
        a: `<ol><li><strong>Strict:</strong> per packet 0.15 + 0.10 + 1.0 = 1.25 µs. 4.0 &times; 10<sup>6</sup> &times; 1.25 µs = 5.0 s of CPU per second, <strong>5.0 cores</strong>, more than half of the 8 receive cores.</li><li><strong>Lazy:</strong> per packet 0.15 + 0.10 + 2.5 / 256 = 0.25 + 0.0098 = 0.2598 µs. 4.0 &times; 10<sup>6</sup> &times; 0.2598 µs &asymp; <strong>1.04 cores</strong>, almost all of it now the map and unmap themselves.</li><li><strong>Stale window:</strong> each core unmaps 4.0 &times; 10<sup>6</sup> / 8 = 500,000 pages per second, so it fills its 256-entry queue in 256 / 500,000 = <strong>512 µs</strong>. For up to that long, the NIC could still write a page the kernel has already reused.</li><li><strong>What drivers do:</strong> they keep buffers mapped and recycle them (the <code>page_pool</code>), so the steady state has no map, unmap, or invalidation at all. The IOMMU still confines the device to the pool's pages.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A single-core appliance receives UDP packets. Assume:</p><ul><li>With one interrupt per packet, taking in each packet costs 3.0 µs of interrupt overhead plus 0.8 µs of protocol processing, and this work always runs before any user thread.</li><li>The application needs 1.0 µs of CPU per packet it consumes, and it gets only the CPU time left over. Packets it can't consume are dropped from the socket buffer after the kernel has processed them.</li><li>With NAPI, the core polls under load with no interrupts, and the poll budget and <code>ksoftirqd</code> let the scheduler split the core so that the kernel takes in only the packets the application consumes. The NIC drops the rest in hardware at no CPU cost.</li></ul><p>Find the delivered rate as a function of the offered rate with interrupts, the peak and the offered rate at which delivery reaches zero, and the delivered rate with NAPI at any offered rate above saturation.</p>`,
        a: `<ol><li><strong>With interrupts:</strong> at an offered rate of <em>&lambda;</em> packets per µs, the kernel uses 3.8<em>&lambda;</em> of each µs, and the application gets 1 &minus; 3.8<em>&lambda;</em>, enough for (1 &minus; 3.8<em>&lambda;</em>) / 1.0 packets. Delivered = min(<em>&lambda;</em>, 1 &minus; 3.8<em>&lambda;</em>).</li><li><strong>Peak:</strong> the two terms meet at <em>&lambda;</em> = 1 &minus; 3.8<em>&lambda;</em>, so <em>&lambda;</em> = 1 / 4.8 per µs &asymp; <strong>208,000</strong> packets per second, the most this configuration can deliver.</li><li><strong>Livelock:</strong> above the peak, delivery falls linearly, and it reaches zero at 1 &minus; 3.8<em>&lambda;</em> = 0, so <em>&lambda;</em> = 1 / 3.8 per µs &asymp; <strong>263,000</strong> packets per second. The core is then 100% busy taking in packets that are all dropped later.</li><li><strong>With NAPI:</strong> each delivered packet costs 0.8 + 1.0 = 1.8 µs, so delivery holds at 1 / 1.8 µs &asymp; <strong>556,000</strong> packets per second at any offered rate above that. It is higher than the interrupt peak because the 3.0 µs per packet is gone, and it is flat because excess packets are dropped before costing anything.</li><li>The assumption about scheduling is the important one. If the softirq were allowed to take in every packet regardless (no budget, no <code>ksoftirqd</code> handoff), polling alone would remove the interrupt cost but could still starve the application at a high enough rate. The general rule from Mogul and Ramakrishnan is to drop excess work at the earliest point, before any CPU time is spent on it.</li></ol>`
      },
      {
        q: `<p>A key-value server on one core handles small requests from thousands of connections. Compare an epoll loop with an io_uring loop. Assume:</p><ul><li>Each loop iteration handles 20 requests, one per ready connection.</li><li>Every system call costs 0.2 µs of entry and exit.</li><li>epoll: one <code>epoll_wait</code> per iteration costs its system call plus 0.1 µs per returned event, and each request then needs a <code>recv</code> (1.0 µs of kernel work) and a <code>send</code> (1.5 µs), each its own system call.</li><li>io_uring: one <code>io_uring_enter</code> per iteration submits the 20 sends and reaps the completions. The kernel work per <code>recv</code> and <code>send</code> is the same as with epoll, and handling each CQE costs 0.05 µs (two per request, using multishot <code>recv</code>).</li><li>The application spends 2.0 µs per request.</li></ul><p>Find requests per second for each. Then redo it with a system call cost of 0.7 µs, as with heavy side-channel mitigations. When does io_uring pay off most?</p>`,
        a: `<ol><li><strong>epoll at 0.2 µs:</strong> per request, 0.2 / 20 = 0.01 µs of <code>epoll_wait</code> plus 0.1 µs for its event, then <code>recv</code> 0.2 + 1.0 and <code>send</code> 0.2 + 1.5, plus 2.0 of application: 0.01 + 0.1 + 1.2 + 1.7 + 2.0 = 5.01 µs, so &asymp; <strong>200,000</strong> requests per second.</li><li><strong>io_uring at 0.2 µs:</strong> 0.2 / 20 = 0.01 µs, plus 1.0 + 1.5 of kernel work, plus 2 &times; 0.05 = 0.1 for CQEs, plus 2.0: 4.61 µs, so &asymp; <strong>217,000</strong> per second. Only 8.7% faster: of the 5.01 µs, only the two per-request system calls (0.4 µs) went away.</li><li><strong>epoll at 0.7 µs:</strong> 0.7 / 20 + 0.1 + (0.7 + 1.0) + (0.7 + 1.5) + 2.0 = 0.035 + 0.1 + 1.7 + 2.2 + 2.0 = 6.035 µs, &asymp; <strong>166,000</strong> per second.</li><li><strong>io_uring at 0.7 µs:</strong> 0.035 + 2.5 + 0.1 + 2.0 = 4.635 µs, &asymp; <strong>216,000</strong> per second, now <strong>1.30 times</strong> epoll. io_uring is almost unaffected by the crossing cost, since it pays one per 20 requests.</li><li>io_uring pays off most when crossings are expensive (mitigations, virtualization) or when the work behind each call is small (page-cache hits, tiny messages), so the crossing is a large share. When the kernel's network stack dominates, as here, removing system calls changes little, and the remaining options are less work per packet (fewer copies, GRO, larger messages) or bypass.</li></ol>`
      },
      {
        q: `<p>A packet-processing service on a Cascade Lake Xeon (27.5 MiB LLC, 11 ways, DDIO allowed 2 ways) uses 8 receive queues with 2 KiB buffers, one queue per core. Raising every queue's ring from 128 to 2,048 descriptors to stop drops during bursts made the drops rarer, but under sustained load the service's throughput fell and DRAM bandwidth rose. Explain why, assuming the rings stay nearly full under sustained load, and say how you'd size the ring.</p>`,
        a: `<ol><li><strong>What DDIO can hold:</strong> 2 of 11 ways is 2 / 11 &times; 27.5 = 5 MiB of LLC for inbound DMA.</li><li><strong>What is waiting:</strong> with nearly full rings, the packets written but not yet read take 8 &times; 128 &times; 2 KiB = 2 MiB with small rings, which fits, and 8 &times; 2,048 &times; 2 KiB = 32 MiB with large rings, 6.4 times too much.</li><li><strong>What happens with large rings:</strong> each new DMA write allocates in the DDIO ways and evicts an older packet that no core has read yet. That packet is written back to DRAM, and when the core reaches it, it misses and reads it from DRAM again. Every packet now costs two DRAM transfers plus a long-latency miss on the core, so per-packet time rises and throughput falls ("leaky DMA").</li><li><strong>Why the deep ring didn't help under sustained load:</strong> a ring only absorbs bursts. If the arrival rate exceeds the service rate for long, any ring fills and drops resume, and a deeper one only adds queueing delay.</li><li><strong>Sizing:</strong> use Little's law, entries needed = arrival rate &times; the longest burst you want to absorb, and keep the total in-flight data across all queues under the DDIO capacity. If that isn't enough, add cores or queues, or change the DDIO way allocation (it is configurable on Xeon), rather than deepening rings. The assumption that the rings stay full is what makes this happen. With rings mostly empty, the in-flight data is small and ring size barely matters.</li></ol>`
      },
      {
        q: `<p>A CPU-bound benchmark that does no I/O runs pinned to core 3 of a server that also serves network traffic. Its runtime is 12% longer and its user-mode IPC 6% lower when traffic is flowing than when the network is quiet, but its profile shows nothing new. <code>/proc/interrupts</code> shows the NIC's queue 3 interrupt landing on core 3 about 40,000 times per second. Explain both effects, how you would confirm them, and how to fix the setup. Assume no SMT sibling shares core 3, the clock frequency is fixed, and the benchmark retires the same user instructions in both runs.</p>`,
        a: `<ol><li><strong>Two causes:</strong> each interrupt runs its hard handler and then the network-receive softirq on core 3, so the benchmark isn't running for that time. Softirq time is charged to the interrupted thread unless it moves to <code>ksoftirqd</code>, which is why it doesn't appear as another process. And the handler and the network stack evict the benchmark's lines from L1 and L2, its TLB entries, and its branch predictor state, so after each interrupt the benchmark runs slower until it warms up again. That lowers IPC even in the cycles counted in user mode.</li><li><strong>Splitting the 12%:</strong> with the same user instructions and 6% lower IPC, the benchmark needs 1 / 0.94 &asymp; 1.064 times its quiet-run user cycles, a 6.4% slowdown from cache and predictor disturbance alone. The rest, 1.12 &minus; 1.064 = 0.056 of the quiet runtime, is time stolen by the handlers. As a share of the noisy run, that is 0.056 / 1.12 = 5.0%, or 50 ms per second, so about 50 ms / 40,000 = 1.25 µs per interrupt, plausible for a hard interrupt plus a short NAPI poll. So slightly more than half the slowdown (6.4 of the 12 points) is the indirect cost on the benchmark's own code, not the handlers' own time.</li><li><strong>Confirming it:</strong> count <code>cycles:u</code> and <code>cycles:k</code> (or <code>instructions:u</code>) on core 3 with <code>perf stat -C 3</code>, and watch <code>/proc/softirqs</code> for NET_RX on core 3. Then move the IRQ and rerun.</li><li><strong>Fixing it:</strong> move the queue's affinity off core 3 (<code>/proc/irq/&lt;n&gt;/smp_affinity</code>, and stop <code>irqbalance</code> from moving it back), or boot with <code>isolcpus=</code> and <code>irqaffinity=</code> so measured cores get no device interrupts. For benchmarking, report the setup as part of the method.</li><li>With an SMT sibling handling the interrupts instead, the time loss would shrink, but the shared caches and predictors would still be disturbed, so the IPC effect would partly remain.</li></ol>`
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
