/* Section: Virtual memory and the OS boundary
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "os"). */

section({
  id: "os",
  name: "Virtual Memory and the OS Boundary",
  cap: "Translation, TLBs, paging, faults, traps, system calls",
  body: `
<p>The hardware and OS cooperate on two things: giving each process its own address space, and moving between user code and the kernel safely. Both show up directly in performance.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A process touches a heap page for the first time. List the hardware and OS events in order.</p>`,
        a: `<ol start="0"><li>The load misses in the TLB, and the page walker reads the page table.</li><li>The leaf entry is not present, so the core raises a page fault on that load (precisely, at commit).</li><li>The kernel's fault handler finds the address is in a valid region, allocates a zeroed physical page, and fills in the page table entry.</li><li>The handler returns; the load re-executes, walks again (or hits a refilled TLB), and completes.</li></ol>`
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
  body: `
<h3>Address Spaces</h3>
<p>Each process sees its own virtual address space. The hardware translates every virtual address (VA) to a physical address (PA) using page tables managed by the OS. This gives isolation, lets physical memory be fragmented while virtual memory looks contiguous, and allows sharing and lazy allocation.</p>
<h3>Pages and Page Tables</h3>
<p>Memory is divided into pages (commonly 4 KB; 16 KB on Apple's ARM systems). A VA splits into a virtual page number and an offset; translation maps the page number to a physical frame and keeps the offset.</p>
<p>A page table entry holds the frame number plus permission and status bits: present, read/write, execute-disable, user/supervisor, accessed, and dirty.</p>
<h3>Why Multilevel</h3>
<p>A flat table for a 48-bit address space with 4 KB pages needs 2<sup>36</sup> entries × 8 bytes = 512 GB per process. A multilevel (radix) table only allocates the parts actually used. On x86-64, each level indexes 9 bits into a 4 KB table of 512 entries: 9 + 9 + 9 + 9 + 12 = 48 bits. A fifth level extends this to 57 bits.</p>
<h3>TLBs</h3>
<ul>
<li><strong>TLB:</strong> a cache of recent translations. Typically a small L1 DTLB and ITLB, backed by a larger unified L2 TLB.</li>
<li><strong>Reach</strong> = entries × page size. Huge pages (2 MB, 1 GB) multiply reach.</li>
<li><strong>Page-walk caches</strong> keep upper-level entries so walks skip levels.</li>
<li><strong>ASIDs / PCIDs</strong> tag entries by address space so a context switch doesn't flush the TLB.</li>
<li><strong>Shootdowns:</strong> when the OS changes a mapping, other cores' TLBs must be invalidated, usually with inter-processor interrupts. This is expensive.</li>
</ul>
<h3>Demand Paging</h3>
<p>Pages are mapped lazily. The first touch of a page triggers a page fault; the OS allocates a frame (zeroed, or read from a file or swap) and fills the entry. A <strong>minor fault</strong> needs no I/O; a <strong>major fault</strong> reads from disk and costs milliseconds.</p>
<h3>Copy-on-Write</h3>
<p>After <code>fork</code>, parent and child share all pages marked read-only. The first write by either one faults; the OS copies that single page and gives the writer a private, writable copy. Untouched pages are never copied.</p>
<h3>Power, Performance, Area</h3>
<ul><li><strong>Bigger TLBs:</strong> more reach, but TLB lookup is in parallel with the L1 access, so L1 TLB size is latency-limited, like L1 cache size.</li><li><strong>Larger pages:</strong> more reach and shorter walks; more internal fragmentation and costlier copy-on-write and zeroing.</li><li><strong>Hardware walkers:</strong> faster than software-managed TLBs; walker area is small, and multiple concurrent walkers help irregular workloads.</li></ul>
<h3>Interaction with Caches</h3>
<p>A VIPT L1 indexes with untranslated offset bits while the TLB translates the tag in parallel, which bounds L1 size to page size × ways. See <a href="#/dcache">Data cache</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>On x86-64 with 4-level paging and 4 KB pages, split the virtual address 0x00007F3A12345678 into its page-table indices and page offset.</p>`,
        a: `<ol start="0"><li>Layout: bits 47–39 (PML4), 38–30 (PDPT), 29–21 (PD), 20–12 (PT), 11–0 (offset).</li><li>Offset: low 12 bits = <strong>0x678</strong>.</li><li>Shift and mask 9 bits for each level: PML4 = <strong>254</strong>, PDPT = <strong>232</strong>, PD = <strong>145</strong>, PT = <strong>325</strong>.</li><li>A walk reads PML4[254] → PDPT[232] → PD[145] → PT[325], then adds 0x678 to the frame address: up to 4 memory accesses per TLB miss.</li></ol>`
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
  id: "exceptions",
  region: "os",
  title: "Faults, Traps, Interrupts, and System Calls",
  body: `
<p>All of these transfer control to a privileged handler. They differ in what causes them and where execution resumes.</p>
<div class="tbl"><table>
<tr><th>Type</th><th>Cause</th><th>Timing</th><th>Resumes at</th><th>Examples</th></tr>
<tr><td>Fault</td><td>Instruction can't complete, but it's fixable</td><td>Synchronous, before completion</td><td>The faulting instruction (re-executed)</td><td>Page fault, protection fault</td></tr>
<tr><td>Trap</td><td>Intentional, or reported after completion</td><td>Synchronous, after completion</td><td>The next instruction</td><td>System call, breakpoint, single-step</td></tr>
<tr><td>Abort</td><td>Unrecoverable error</td><td>Synchronous or not</td><td>Usually doesn't resume</td><td>Machine check, double fault</td></tr>
<tr><td>Interrupt</td><td>External device or timer</td><td>Asynchronous</td><td>Between instructions</td><td>Timer, I/O completion, inter-processor interrupt</td></tr>
</table></div>
<h3>Privilege Levels</h3>
<p>x86 has rings 0–3 (kernel in 0, user in 3). ARM has exception levels EL0 (user), EL1 (kernel), EL2 (hypervisor), and EL3 (secure monitor). RISC-V has user, supervisor, and machine modes.</p>
<h3>The Hardware Sequence</h3>
<ol start="0"><li>Record the cause and the PC to resume at (and the faulting address, if any).</li><li>Raise privilege and switch to the kernel stack.</li><li>Jump to the handler through a vector table (x86 IDT, ARM VBAR, RISC-V stvec/mtvec).</li><li>The handler runs, then a return instruction (<code>iret</code>/<code>sysret</code>, <code>eret</code>, <code>sret</code>/<code>mret</code>) restores state.</li></ol>
<h3>System Calls</h3>
<p>User code puts a call number and arguments in registers and executes <code>syscall</code> (x86-64), <code>svc</code> (ARM), or <code>ecall</code> (RISC-V). The kernel dispatches through a table, does the work, and returns. A bare call costs on the order of 100 ns; the real cost includes cache and TLB pollution from kernel code.</p>
<h3>In an Out-of-Order Core</h3>
<p>Exceptions are precise: they are recorded in the ROB and taken only at commit. Interrupts are taken between committed instructions, typically by flushing the pipeline. See <a href="#/rob">Reorder buffer</a>.</p>
<h3>Performance Trade-Offs</h3>
<ul><li>Each kernel crossing flushes the pipeline and pollutes caches, branch predictors, and TLBs; frequent crossings hurt user-code IPC afterward.</li><li>Interrupt coalescing and polling trade latency for throughput in I/O-heavy servers.</li><li>Security mitigations (page-table isolation, predictor flushes) add cost at every crossing.</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>A server makes 1 million system calls per second per core, each costing 500 ns of entry, dispatch, and exit overhead. What fraction of the core goes to overhead, and what would you do?</p>`,
        a: `<ol start="0"><li>Overhead per second = 10<sup>6</sup> × 500 ns = 0.5 s.</li><li>That's <strong>50%</strong> of the core.</li><li>Reduce the count: batch work per call (<code>io_uring</code>, <code>sendmmsg</code>), use vDSO for calls like <code>clock_gettime</code> that need no kernel entry, or bypass the kernel for I/O.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Walk through what an out-of-order core does when a load page-faults.</p>`,
        a: `<ol start="0"><li>The load misses the TLB, and the walker finds a non-present entry. The load is marked faulting in its ROB entry; nothing architectural happens yet.</li><li>If an older branch was mispredicted, the load is squashed and the fault disappears.</li><li>When the load reaches the ROB head, the core flushes it and everything younger, saves the faulting PC and address (CR2 on x86, FAR on ARM), switches to kernel mode, and jumps to the fault vector.</li><li>The handler maps the page and returns; the load re-executes from the saved PC.</li></ol>`
      },
      {
        q: `<p>Why did system calls get more expensive after Meltdown?</p>`,
        a: `<p>Meltdown let user code speculatively read kernel memory mapped in the same address space. The fix, kernel page-table isolation, gives the kernel a separate page table, so every system call and interrupt switches page tables (and without PCIDs, flushes the TLB). That adds hundreds of cycles to each entry and exit; newer cores fix the hardware flaw so the isolation can be dropped.</p>`
      }
    ]
  }
}
]);
