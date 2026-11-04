/* Section: Kernel entry
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "os"). */

section({
  id: "os",
  name: "Kernel Entry",
  cap: "What an OS does, the kernel and the shell, privilege levels, faults, traps, interrupts, system calls, the hardware sequence on entry, vectors and the IDT, returning to user mode",
  sections: [
    { id: "what-os", label: "What an Operating System Is" },
    { id: "what-it-does", label: "What It Does" },
    { id: "kernel", label: "The Kernel" },
    { id: "shell", label: "The Shell" },
    { id: "pages", label: "How the Pages Fit Together" }
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
<p>The shell is also a programming language, with variables, conditionals, loops, and functions, so sequences of commands can be saved as scripts. It is separate from the <strong>terminal</strong>: the terminal emulator draws text and reads keys, the shell interprets commands, and a pseudo-terminal connects the two.</p>

<h3 id="sec-pages">How the Pages Fit Together</h3>
<p>The kernel runs only when something enters it, so this region covers the way in and out:</p>
<ul>
<li><a href="#/privilege-levels">Privilege Levels</a>: the hardware modes that separate user code, the kernel, the hypervisor, and firmware, and what crossing between them costs.</li>
<li><a href="#/exceptions">Faults, Traps, Interrupts, and System Calls</a>: what the core does on every kernel entry, from the precise exception to the return to user mode.</li>
</ul>
<p>The rest of the Operating System tab builds on that path:</p>
<ul>
<li><a href="#/r/task">Processes and Threads</a>: creating processes, sharing cores among threads, and synchronization.</li>
<li><a href="#/r/osmem">OS Memory Management</a>: demand paging, copy-on-write, page replacement, and memory mapping.</li>
<li><a href="#/r/io">Files and I/O</a>: the file interface and the path from a system call down to a device.</li>
</ul>`,
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
}
]);
