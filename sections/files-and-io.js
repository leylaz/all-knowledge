/* Section: Files and I/O
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "io"). */

section({
  id: "io",
  name: "Files and I/O",
  cap: "File descriptors, open, read, write, fsync, dup2 and pipe, the I/O path, MSI-X, top and bottom halves, DMA rings, the IOMMU, NAPI, interrupt coalescing, blk-mq, epoll, io_uring, kernel bypass, zero-copy",
  sections: [
    { id: "pages", label: "How the Pages Fit Together" }
  ],
  body: `
<p>Programs see files, pipes, and sockets through one interface: small integer file descriptors with <code>read</code> and <code>write</code>. Underneath, the kernel turns each request into commands for a device, the device moves the data with DMA, and an interrupt or a poll tells the kernel it's done. These pages start with the interface and then follow one I/O down to the device and back.</p>
<p>Fast devices change where the time goes. An NVMe SSD answers in tens of microseconds and a 100 GbE NIC delivers millions of packets per second, so the per-I/O CPU cost of system calls, interrupts, and copies decides throughput.</p>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/file-syscalls">File System Calls</a>: descriptors and the tables behind them, reading and writing, sharing descriptors, and making data durable.</li>
<li><a href="#/io-path">The I/O Path and Device Drivers</a>: interrupts, DMA rings, the IOMMU, polling, the block layer, and the ways to cut the kernel's cost per I/O or bypass it.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A 100 GbE NIC receives a stream of 1500-byte packets at line rate. Each packet also takes 38 bytes on the wire for the Ethernet header, FCS, preamble, and inter-frame gap. Handling one interrupt costs about 1 µs of CPU time. How many cores does interrupt handling alone take with one interrupt per packet, and with 64 packets per interrupt?</p>`,
        a: `<ol><li><strong>Bits per packet on the wire:</strong> (1500 + 38) × 8 = 12,304 bits.</li><li><strong>Packet rate:</strong> 100 × 10<sup>9</sup> / 12,304 ≈ 8.13 million packets per second.</li><li><strong>One interrupt per packet:</strong> 8.13 × 10<sup>6</sup> × 1 µs ≈ 8.1 seconds of CPU time per second, so about <strong>8 cores</strong> before any protocol processing.</li><li><strong>64 packets per interrupt:</strong> 8.13 × 10<sup>6</sup> / 64 ≈ 127,000 interrupts per second, or about <strong>0.13 cores</strong>.</li><li><strong>Takeaway:</strong> this is why NICs coalesce interrupts and NAPI switches to polling under load. The price is latency, since a packet can wait for the batch to fill or the coalescing timer to fire.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A database issues 1 million random 4 KiB reads per second to a set of NVMe SSDs, using a pool of threads that each call <code>pread</code> and block. Moving to io_uring cut its CPU use by a third, but the read latency didn't change. Explain both.</p>`,
        a: `<ul><li><strong>Latency is the device's:</strong> a 4 KiB random read takes tens of microseconds on the flash itself, and the DMA and completion path are the same either way. io_uring changes how requests reach the kernel, not how long the SSD takes.</li><li><strong>Fewer system calls:</strong> with <code>pread</code>, every read is a kernel entry and exit, and with mitigations such as KPTI that is a noticeable cost at a million per second. io_uring batches many submissions into one <code>io_uring_enter</code> call, or none with SQPOLL, and completions are read from a shared ring without a system call.</li><li><strong>Fewer context switches:</strong> each blocking <code>pread</code> puts its thread to sleep and the completion wakes it, so every read costs about two switches with cold caches afterwards. With io_uring, a few threads keep many reads in flight and never block on a single one.</li><li><strong>Fewer threads:</strong> enough threads to keep a million reads per second in flight means thousands of stacks and a busy scheduler. A few threads with deep rings avoid both.</li></ul>`
      }
    ]
  }
}, [
{
  id: "file-syscalls",
  region: "io",
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
  region: "io",
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
}
]);
