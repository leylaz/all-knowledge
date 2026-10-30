/* Section: Virtual memory and the OS boundary
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "os"). */

section({
  id: "os",
  name: "Virtual Memory and the OS Boundary",
  cap: "Translation, TLBs, paging, mmap, copy-on-write, faults, traps, system calls",
  body: `
<p>The hardware and OS cooperate on two things: giving each process its own address space, and moving between user code and the kernel safely. Both show up directly in performance.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A process touches a heap page for the first time. List the hardware and OS events in order.</p>`,
        a: `<ol><li>The load misses in the TLB, and the page walker reads the page table.</li><li>The leaf entry is not present, so the core raises a page fault on that load (precisely, at commit).</li><li>The kernel's fault handler finds the address is in a valid region, allocates a zeroed physical page, and fills in the page table entry.</li><li>The handler returns; the load re-executes, walks again (or hits a refilled TLB), and completes.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why is a page fault a "fault" and a system call a "trap"? What does that change for the return address?</p>`,
        a: `<p>A fault is reported before the instruction completes, so the saved PC points at the faulting instruction and it is re-executed after the handler fixes the cause. A trap is reported after the instruction completes, so the saved PC points to the next instruction and execution continues past it.</p>`
      }
    ]
  }
}, [
{
  id: "virtual-memory",
  region: "os",
  title: "Virtual and Physical Memory",
  sections: [
    { id: "address-spaces", label: "Address Spaces" },
    { id: "pages-page-tables", label: "Pages and Page Tables" },
    { id: "multilevel", label: "Why Multilevel" },
    { id: "tlbs", label: "TLBs" },
    { id: "demand-paging-cow", label: "Demand Paging and Copy-on-Write" },
    { id: "interaction-caches", label: "Interaction with Caches" },
    { id: "power-performance-area", label: "Power, Performance, Area" }
  ],
  body: `
<h3 id="sec-address-spaces">Address Spaces</h3>
<p>Each process sees its own virtual address space. The hardware translates every virtual address (VA) to a physical address (PA) using page tables managed by the OS. This gives isolation, lets physical memory be fragmented while virtual memory looks contiguous, and allows sharing and lazy allocation.</p>
<h3 id="sec-pages-page-tables">Pages and Page Tables</h3>
<p>Memory is divided into pages (commonly 4 KB; 16 KB on Apple's ARM systems). A VA splits into a virtual page number and an offset; translation maps the page number to a physical frame and keeps the offset.</p>
<p>A page table entry holds the frame number plus permission and status bits: present, read/write, execute-disable, user/supervisor, accessed, and dirty.</p>
<h3 id="sec-multilevel">Why Multilevel</h3>
<p>A flat table for a 48-bit address space with 4 KB pages needs 2<sup>36</sup> entries × 8 bytes = 512 GB per process. A multilevel (radix) table only allocates the parts actually used. On x86-64, each level indexes 9 bits into a 4 KB table of 512 entries: 9 + 9 + 9 + 9 + 12 = 48 bits. A fifth level extends this to 57 bits.</p>
<h3 id="sec-tlbs">TLBs</h3>
<p>Walking four levels of table on every access would be far too slow, so the core caches recent translations in TLBs, tagged by address space so a context switch doesn't flush them. Reach, page walks, page-walk caches, and nested walks under virtualization are in <a href="#/tlb">TLBs and Page Walks</a>.</p>
<h3 id="sec-demand-paging-cow">Demand Paging and Copy-on-Write</h3>
<p>The OS maps pages lazily: the first touch of a page faults, and the kernel fills in the entry then. After <code>fork</code>, parent and child share pages read-only until one of them writes. Both are covered in <a href="#/demand-paging">Demand Paging and Copy-on-Write</a>, and programs create their own mappings with <code>mmap</code>, covered in <a href="#/mmap">Memory Mapping</a>.</p>
<h3 id="sec-interaction-caches">Interaction with Caches</h3>
<p>A VIPT L1 indexes with untranslated offset bits while the TLB translates the tag in parallel, which bounds L1 size to page size × ways. See <a href="#/dcache">Data cache</a>.</p>
<h3 id="sec-power-performance-area">Power, Performance, Area</h3>
<ul><li><strong>Bigger TLBs:</strong> more reach, but TLB lookup is in parallel with the L1 access, so L1 TLB size is latency-limited, like L1 cache size.</li><li><strong>Larger pages:</strong> more reach and shorter walks; more internal fragmentation and costlier copy-on-write and zeroing.</li><li><strong>Hardware walkers:</strong> faster than software-managed TLBs; walker area is small, and multiple concurrent walkers help irregular workloads.</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>On x86-64 with 4-level paging and 4 KB pages, split the virtual address 0x00007F3A12345678 into its page-table indices and page offset.</p>`,
        a: `<ol><li>Layout: bits 47–39 (PML4), 38–30 (PDPT), 29–21 (PD), 20–12 (PT), 11–0 (offset).</li><li>Offset: low 12 bits = <strong>0x678</strong>.</li><li>Shift and mask 9 bits for each level: PML4 = <strong>254</strong>, PDPT = <strong>232</strong>, PD = <strong>145</strong>, PT = <strong>325</strong>.</li><li>A walk reads PML4[254] → PDPT[232] → PD[145] → PT[325], then adds 0x678 to the frame address: up to 4 memory accesses per TLB miss.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A key-value store does random reads over a 64 GB table. The L2 TLB has 2048 entries. What's the TLB reach with 4 KB and 2 MB pages, and what do you expect?</p>`,
        a: `<p>Reach with 4 KB pages: 2048 × 4 KB = 8 MB, so nearly every access misses the TLB and pays a page walk; the upper levels often hit in the data cache or page-walk caches, but the leaf entries miss too. With 2 MB pages: 2048 × 2 MB = 4 GB, still far below 64 GB, but the page table is 512× smaller, so walks hit in cache far more often and are one level shorter. With 1 GB pages, 64 entries cover the table. Expect large speedups from huge pages on this workload.</p>`
      },
      {
        q: `<p>How many memory accesses can a TLB miss cost under virtualization with 4-level guest and host page tables?</p>`,
        a: `<p>Every guest page-table pointer is a guest-physical address that must itself be translated through the 4-level host table. With n guest levels and m host levels, the worst case is (n + 1)(m + 1) − 1 = 5 × 5 − 1 = <strong>24</strong> accesses. Nested TLBs, page-walk caches, and huge pages in both layers cut this sharply.</p>`
      }
    ]
  }
},

{
  id: "tlb",
  region: "os",
  title: "TLBs and Page Walks",
  sections: [
    { id: "hierarchy", label: "The TLB Hierarchy" },
    { id: "reach", label: "TLB Reach and Huge Pages" },
    { id: "walk", label: "What a Page Walk Does" },
    { id: "pwc", label: "Page-Walk Caches and Walkers" },
    { id: "virt", label: "Virtualization: Two-Dimensional Walks" },
    { id: "model", label: "Modeling Translation" }
  ],
  body: `
<p>Every load, store, and instruction fetch needs its virtual address translated before (or while) the cache is accessed. <a href="#/virtual-memory">Virtual and Physical Memory</a> covers the OS side; this page covers the hardware that makes translation fast and what it costs when it isn't.</p>

<h3 id="sec-hierarchy">The TLB Hierarchy</h3>
<p>Translation is cached in TLBs organized like data caches:</p>
<ul>
<li><strong>L1 TLBs</strong>, separate for instructions and data, small (tens of entries) and fast enough to look up in parallel with the L1 cache. With a virtually indexed, physically tagged L1, the cache set is chosen from page-offset bits while the TLB translates the rest, so translation adds no latency on a hit.</li>
<li><strong>A shared L2 TLB</strong> (thousands of entries) behind them, a few cycles slower. Zen 4, for example, has a 72-entry L1 DTLB and a 3,072-entry L2 DTLB.</li>
<li>Entries carry the page size, permissions, and an address-space tag (ASID or PCID) so context switches don't need a flush.</li>
</ul>

<h3 id="sec-reach">TLB Reach and Huge Pages</h3>
<p><strong>Reach</strong> is how much memory the TLB covers: entries × page size. With 4 KB pages, a 3,072-entry L2 TLB reaches 12 MB, smaller than many last-level caches, so a workload can hit in L3 and still miss in the TLB on every access. With 2 MB pages the same entries reach 6 GB.</p>
<p>That is why large-memory workloads (databases, JVMs, HPC codes, in-memory key-value stores) use huge pages, through explicit reservations or the kernel's transparent huge pages. The costs: memory fragmentation, internal waste for sparse data, and slower page faults (zeroing 2 MB at once).</p>

<h3 id="sec-walk">What a Page Walk Does</h3>
<p>On an L2 TLB miss, a hardware <strong>page walker</strong> reads the page table. On x86-64 with 4-level paging, a 48-bit virtual address splits into four 9-bit indices and a 12-bit offset:</p>
<pre><code>bits 47..39  PML4 index   -&gt; read PML4 entry  (memory reference 0)
bits 38..30  PDPT index   -&gt; read PDPT entry  (memory reference 1; a 1 GB page stops here)
bits 29..21  PD index     -&gt; read PD entry    (memory reference 2; a 2 MB page stops here)
bits 20..12  PT index     -&gt; read PT entry    (memory reference 3)
bits 11..0   page offset</code></pre>
<p>Each step is a dependent load: the next table's address comes from the entry just read. The walker's loads go through the data caches, so a walk whose entries are all in L1 or L2 costs tens of cycles, while one that misses to DRAM at every level costs several DRAM latencies. 5-level paging (57-bit addresses) adds a fifth level, and Armv8 and RISC-V Sv48 work the same way with their own table formats.</p>

<h3 id="sec-pwc">Page-Walk Caches and Walkers</h3>
<ul>
<li><strong>Page-walk caches</strong> (Intel's paging-structure caches) keep recently used upper-level entries, so most walks skip straight to the last one or two levels. The upper levels cover huge regions, so a few dozen entries hit almost always.</li>
<li><strong>Multiple walkers:</strong> a core with one walker serializes all TLB misses; Intel went from one to two walkers in Broadwell, and recent cores have more. Walkers act like MSHRs for translation: their count caps how many TLB misses overlap.</li>
<li><strong>Prefetching and speculation:</strong> walks can start for speculative loads, and some cores prefetch translations for the next page in a streaming pattern.</li>
</ul>

<h3 id="sec-virt">Virtualization: Two-Dimensional Walks</h3>
<p>Under hardware virtualization (Intel EPT, AMD NPT), the guest's page table holds guest-physical addresses, and each of them must itself be translated through the host's table. With 4 levels on each side, a walk can need up to (4 + 1) × (4 + 1) − 1 = <strong>24</strong> memory references: each of the guest's 4 table reads and the final guest-physical address needs a host walk of up to 4 references, plus the 4 guest reads themselves. Page-walk caches for both dimensions and huge pages on the host side are what keep virtualized TLB misses affordable.</p>

<h3 id="sec-model">Modeling Translation</h3>
<ul>
<li>Model the walk as real loads through the cache hierarchy, not a fixed latency; walk cost depends on whether page-table lines are cached, which depends on the workload's footprint.</li>
<li>Model the number of walkers and page-walk caches, since they set translation's MLP.</li>
<li>Use the page sizes the real system would use: a simulator that hands out 4 KB pages for a workload that runs on 2 MB pages in production overstates TLB misses enormously, and vice versa.</li>
<li>Count TLB shootdowns and context switches if the workload has them; trace-driven models usually don't see them.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix B and Chapter 2 (virtual memory and TLBs) · Bhargava, Serebrin, Spadini, and Manne, "Accelerating Two-Dimensional Page Walks for Virtualized Systems," ASPLOS 2008 · Intel, <em>Intel 64 and IA-32 Architectures Software Developer's Manual</em>, Volume 3, Chapter 4 (paging) · AMD, <em>Software Optimization Guide for the AMD Zen 4 Microarchitecture</em></p>`,
  practice: {
    guided: [
      {
        q: `<p>A key-value store randomly accesses a 32 GB table on a core whose L2 TLB has 2,048 entries for 4 KB or 2 MB pages and 16 entries for 1 GB pages. A 1 GB page walk reads only the top two page-table levels. What fraction of accesses miss the TLB with 4 KB pages, with 2 MB pages, and with 1 GB pages (assume uniform random access, and that the TLB holds only data pages)?</p>`,
        a: `<ol><li>4 KB pages: reach 2,048 × 4 KB = 8 MB. Hit fraction ≈ 8 MB / 32 GB ≈ 0.024%, so <strong>almost every access misses</strong>.</li><li>2 MB pages: reach 4 GB, so hit fraction ≈ 4 / 32 = 12.5%: about <strong>87.5% miss</strong>. Better per walk (fewer levels, smaller page tables that cache well), but still mostly misses.</li><li>1 GB pages: the table needs only 32 translations, but only 16 fit. Hit fraction ≈ 16 / 32 = 50%, so <strong>about 50% miss</strong>. Each walk, though, reads only two levels, and those 32 entries sit in a few lines that stay cached, so translation cost nearly disappears.</li><li>For random access over huge data, only 1 GB pages remove translation cost; 2 MB pages mainly make each walk cheaper.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A workload runs 30% slower inside a virtual machine than on bare metal, with no I/O involved. The guest and host both use 4-level page tables. Counters show the same L2 TLB miss rate in both. Explain the gap and propose fixes.</p>`,
        a: `<p>The miss rate is the same, but each miss costs far more: a native walk is up to 4 dependent references, while a nested walk is up to 24, and the extra host-table lines compete for cache space, so more of those references miss. Confirm with page-walk cycles per miss (Intel's <code>DTLB_LOAD_MISSES.WALK_ACTIVE</code> divided by completed walks) inside and outside the VM. Fixes: back the guest with huge pages on the host (2 MB or 1 GB host pages remove most of the host dimension), use huge pages in the guest too, and make sure the host doesn't split those pages (for example, through memory overcommit or deduplication).</p>`
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
    { id: "hardware-sequence", label: "The Hardware Sequence" },
    { id: "trap-frame", label: "The Handler and the Trap Frame" },
    { id: "return", label: "Returning to User Mode" },
    { id: "system-calls", label: "System Calls" },
    { id: "performance-trade-offs", label: "Performance Trade-Offs" }
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
<li><strong>Take it at the head:</strong> when the entry reaches the ROB head, every older instruction has committed. The core flushes the ROB, the issue queues, and the load and store queues, and restores the rename map from the committed (retirement) map. Stores that already committed and sit in the store buffer still drain to memory, since they are architectural. Then the front end is redirected to the handler.</li>
</ol>
<p>Because exceptions are taken in commit order, the oldest one always wins, even if a younger instruction detected its fault first. An interrupt has no faulting instruction, so the core chooses a boundary: it flushes everything uncommitted and saves the PC of the oldest uncommitted instruction as the resume point. Flushing keeps interrupt latency short but throws away the work in flight, which in a 512-entry ROB (Intel's Golden Cove) can be hundreds of instructions that are fetched again after the handler. See <a href="#/rob">Reorder buffer</a>.</p>

<h3 id="sec-hardware-sequence">The Hardware Sequence</h3>
<p>Once the exception is taken, the core runs a fixed sequence with no software involved. RISC-V shows it most plainly. For an exception taken from user mode into supervisor mode:</p>
<ol>
<li><strong>Save the resume PC</strong> in <code>sepc</code>: the faulting instruction for a fault, the <code>ecall</code> itself for a system call, or the oldest uncommitted instruction for an interrupt.</li>
<li><strong>Record the cause</strong> in <code>scause</code>, an interrupt bit plus a code (13 for a load page fault, 8 for an <code>ecall</code> from user mode), and the detail in <code>stval</code>: the faulting virtual address, or the bits of an illegal instruction.</li>
<li><strong>Save the old mode and interrupt state</strong> in <code>sstatus</code>. SPP takes the previous privilege, SPIE takes the old interrupt-enable bit, and SIE is cleared, so the handler starts with interrupts off.</li>
<li><strong>Raise privilege</strong> to supervisor mode.</li>
<li><strong>Jump</strong> to the address in <code>stvec</code>, which the kernel set at boot. In vectored mode, interrupts go to the base plus 4 × the cause code instead.</li>
</ol>
<p>RISC-V saves no general registers and doesn't switch stacks. x86 and ARM do some of that in hardware:</p>
<div class="tbl"><table>
<tr><th>Step</th><th>x86-64 (interrupt or exception from ring 3)</th><th>ARMv8-A (EL0 to EL1)</th><th>RISC-V (user to supervisor)</th></tr>
<tr><td>Resume PC</td><td>Pushed on the kernel stack (RIP)</td><td>ELR_EL1</td><td><code>sepc</code></td></tr>
<tr><td>Cause</td><td>The vector number selects the IDT entry, some vectors push an error code, and CR2 holds a page fault's address</td><td>ESR_EL1 (exception class and syndrome), FAR_EL1 for the address</td><td><code>scause</code>, <code>stval</code></td></tr>
<tr><td>Old state</td><td>RFLAGS, CS, SS, and RSP pushed, and an interrupt gate clears IF</td><td>SPSR_EL1 takes PSTATE, and the DAIF masks are set</td><td><code>sstatus</code> SPP and SPIE, SIE cleared</td></tr>
<tr><td>Stack</td><td>Loads RSP from the TSS (RSP0, or an IST entry for faults that need a known-good stack)</td><td>Switches to the banked SP_EL1</td><td>None. The handler finds its own.</td></tr>
<tr><td>Handler address</td><td>The IDT entry for the vector</td><td>VBAR_EL1 plus an offset for the source level and type (0x400 for a synchronous exception from AArch64 EL0)</td><td><code>stvec</code></td></tr>
<tr><td>Return instruction</td><td><code>iretq</code>, or <code>sysretq</code> after <code>syscall</code></td><td><code>eret</code></td><td><code>sret</code></td></tr>
</table></div>

<h3 id="sec-trap-frame">The Handler and the Trap Frame</h3>
<p>The hardware saves only what it must to reach the handler. The kernel's entry code, written in assembly, saves everything else before any C code runs:</p>
<ol>
<li><strong>Get a trustworthy stack.</strong> The user stack pointer can't be used: it may be unmapped, point into kernel memory, or be changed by another user thread mid-call. On RISC-V, the entry code swaps a register with <code>sscratch</code>, which the kernel loaded with a pointer to the current thread's kernel data, and finds the kernel stack from there. On x86-64, <code>syscall</code> doesn't switch stacks, so the entry code runs <code>swapgs</code> to reach per-CPU data, saves the user RSP there, and loads the kernel stack pointer.</li>
<li><strong>Build the trap frame.</strong> Push all general registers, plus the saved PC, status, and cause, onto the kernel stack. This <strong>trap frame</strong> (<code>struct pt_regs</code> on Linux) is the user thread's complete register state.</li>
<li><strong>Dispatch</strong> to the C handler for the cause: the page-fault handler, the system-call table, or a device's interrupt handler.</li>
</ol>
<p>The trap frame is what the rest of the kernel works on. A system call returns its result by writing the saved <code>rax</code> or <code>a0</code>. A context switch is the kernel returning through a different thread's trap frame. A signal is delivered by editing the saved PC.</p>

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
<p>Some calls skip the kernel entirely. The kernel maps a small shared library, the <strong>vDSO</strong>, into every process, along with a read-only data page that it keeps updated. <code>clock_gettime</code> reads the time from that page and the timestamp counter in user mode, in tens of nanoseconds instead of a kernel entry. The calls programs make most often are covered in <a href="#/file-syscalls">File System Calls</a> and <a href="#/mmap">Memory Mapping</a>.</p>

<h3 id="sec-performance-trade-offs">Performance Trade-Offs</h3>
<ul>
<li><strong>Direct cost:</strong> a null system call such as <code>getppid</code> takes on the order of 100 ns on a recent core. Mitigations for speculative-execution attacks (KPTI's page-table switch, predictor barriers) can multiply that.</li>
<li><strong>Indirect cost:</strong> each crossing flushes the pipeline, and the kernel's code and data displace user state in the L1 caches, branch predictors, and TLBs. Soares and Stumm (FlexSC, OSDI 2010) found that user-mode IPC stays depressed for thousands of cycles after a system call, so the indirect cost can exceed the direct one.</li>
<li><strong>Batching:</strong> <code>io_uring</code> passes requests and completions through rings shared with the kernel, so one system call, or none with kernel-side polling, covers many operations.</li>
<li><strong>Interrupts:</strong> interrupt coalescing and polling trade latency for throughput in I/O-heavy servers.</li>
<li><strong>For a simulator:</strong> syscall-emulation mode (gem5 SE) carries out each call in the simulator, so neither the kernel's instructions nor its pollution of caches and predictors appears. Workloads that cross often need full-system simulation.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A server makes 1 million system calls per second per core, each costing 500 ns of entry, dispatch, and exit overhead. What fraction of the core goes to overhead, and what would you do?</p>`,
        a: `<ol><li>Overhead per second = 10<sup>6</sup> × 500 ns = 0.5 s.</li><li>That's <strong>50%</strong> of the core.</li><li>Reduce the count: batch work per call (<code>io_uring</code>, <code>sendmmsg</code>), use vDSO for calls like <code>clock_gettime</code> that need no kernel entry, or bypass the kernel for I/O.</li></ol>`
      },
      {
        q: `<p>On RISC-V Linux, a user program executes <code>ecall</code> at address 0x10a4c with a7 = 63 (<code>read</code>) and interrupts enabled. Give <code>sepc</code>, <code>scause</code>, SPP, and SIE right after the trap, the PC the program resumes at, and what happens if the kernel forgets to adjust <code>sepc</code>.</p>`,
        a: `<ol><li><code>sepc</code> = <strong>0x10a4c</strong>, the address of the <code>ecall</code> itself.</li><li><code>scause</code> = <strong>8</strong>, environment call from user mode, with the interrupt bit clear.</li><li>SPP = <strong>0</strong> (the trap came from user mode). SPIE takes the old SIE value, 1, and SIE = <strong>0</strong>.</li><li>The PC jumps to <code>stvec</code>. The entry code builds the trap frame, the dispatcher calls the <code>read</code> handler (number 63), and the result goes into the saved a0.</li><li>Before <code>sret</code>, the kernel sets <code>sepc</code> = 0x10a4c + 4 = <strong>0x10a50</strong>, so the program resumes after the <code>ecall</code>.</li><li>Without that adjustment, <code>sret</code> returns to the <code>ecall</code>, which traps again with the same a7 (and the result in a0 as the new first argument), so the program never gets past it.</li></ol>`
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
        q: `<p>On x86-64, <code>syscall</code> doesn't switch stacks. Why can't the kernel just keep running on the user's stack for the call?</p>`,
        a: `<ul><li><strong>It may not be valid.</strong> User code can set RSP to anything. If it points at an unmapped page, the kernel's first push faults inside the kernel entry path, before any state is saved.</li><li><strong>It may point at kernel memory.</strong> The kernel's pushes would then overwrite its own data, a direct privilege escalation.</li><li><strong>Other threads can change it.</strong> Another user thread sharing the address space can rewrite that stack while the kernel uses it, corrupting saved state or return addresses.</li><li><strong>It would leak data.</strong> Kernel values left on a user-readable stack would be visible to user code afterward.</li></ul><p>So the entry code saves the user RSP and loads a per-thread kernel stack, reached through <code>swapgs</code> and per-CPU data, before it pushes anything. Interrupts and exceptions get the same protection in hardware from the TSS stack switch.</p>`
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
    { id: "backing", label: "Demand Paging and Backing Objects" },
    { id: "cow", label: "Copy-on-Write After Fork" },
    { id: "spawn", label: "Starting a New Program: Exec and Spawn" },
    { id: "perf", label: "Performance Trade-Offs" }
  ],
  body: `
<p>Once every access goes through a page table, the OS can point any virtual page at any physical frame, or at nothing yet. Two features fall out of that one layer of indirection: loading pages only when they are touched (demand paging), and letting processes share a page until one of them writes to it (copy-on-write). Both work by having the CPU, the OS, and user code see different things about the same page, and both rely on the page fault being precise and restartable (see <a href="#/exceptions">Faults, Traps, Interrupts, and System Calls</a>). The next page, <a href="#/mmap">Memory Mapping</a>, hands the same machinery to the program. Builds on <a href="#/virtual-memory">Virtual and Physical Memory</a>. Main sources: Bryant and O’Hallaron’s <em>Computer Systems: A Programmer’s Perspective</em> (chapter 9) and Chris Kanich’s CS 361 lecture on memory mapping.</p>

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

<h3 id="sec-spawn">Starting a New Program: Exec and Spawn</h3>
<ul>
<li><strong><code>exec</code></strong> throws away the address space and builds a new one: new regions pointing at the new executable's file offsets, all not present. No memory is used until the program starts touching its pages, and the page cache and readahead usually have the hot pages ready before they are needed.</li>
<li><strong><code>fork</code> then <code>exec</code></strong> still pays for the fork: copying the page table and write-protecting every writable page of the parent, even though the child is about to discard all of it. For a parent with tens of gigabytes mapped, that is tens of megabytes of page-table entries to copy, then a write fault on the first store to each page.</li>
<li><strong><code>posix_spawn</code></strong> avoids the copy. glibc implements it with <code>clone(CLONE_VM | CLONE_VFORK)</code>: the child runs on the parent's own page table, with no copy and no write-protection, while the parent waits. The child does only a fixed list of safe steps (the file actions, such as redirecting descriptors), then calls <code>exec</code>, at which point the parent resumes. Because those steps are known not to disturb the parent's memory, sharing the address space for that short window is safe.</li>
</ul>

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
}
]);
