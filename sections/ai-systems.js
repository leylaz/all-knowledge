/* Section: AI systems
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "aisys"). */

section({
  id: "aisys",
  name: "AI Systems",
  cap: "The whole machine around the model, starting with the CPU",
  sections: [
    { id: "map", label: "Where the CPU Shows Up" }
  ],
  body: `
<p>The other regions on this tab explain what a model computes. This one asks what it takes to run that computation as a system: who feeds the accelerators, where data and state live, and what work happens between model calls. It starts with the CPU, because nearly every AI system still has one at its center.</p>
<h3 id="sec-map">Where the CPU Shows Up</h3>
<div class="tbl"><table>
<tr><th>Role</th><th>What the CPU does</th><th>Page</th></tr>
<tr><td>Big picture</td><td>Why a GPU-heavy machine still depends on its CPU</td><td><a href="#/cpu-ai-why">Why CPUs Still Matter for AI</a></td></tr>
<tr><td>Host</td><td><ul><li>Loads and preprocesses data</li><li>Launches kernels</li><li>Schedules requests and batches</li></ul></td><td><a href="#/cpu-ai-host">The CPU as Host</a></td></tr>
<tr><td>Inference engine</td><td>Runs small models and low-batch serving with its own matrix units</td><td><a href="#/cpu-ai-infer">Running Models on the CPU</a></td></tr>
<tr><td>Everything between model calls</td><td><ul><li>Tool calls and code sandboxes</li><li>Vector search for retrieval</li></ul></td><td><a href="#/cpu-ai-agents">Agents, Tools, and Retrieval</a></td></tr>
<tr><td>Memory tier</td><td>Holds KV caches, weights, optimizer state, and embedding tables that don't fit in HBM</td><td><a href="#/cpu-ai-memory">The CPU as a Memory Tier</a></td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A server pairs 2 AMD EPYC 9575F CPUs (64 cores each) with 8 GPUs. Its image pipeline costs 1.5 cores for every 1,000 images/s it delivers, and each GPU consumes 9,000 images/s. Does the CPU keep up, and how many cores per GPU are left for everything else?</p>`,
        a: `<ol><li>Cores per GPU: 2 CPUs × 64 cores/CPU / 8 GPUs = 16 cores/GPU.</li><li>Pipeline demand: 9,000 images/s / 1,000 images/s × 1.5 cores = 13.5 cores/GPU.</li><li>It keeps up, with 16 cores/GPU − 13.5 cores/GPU = <strong>2.5 cores/GPU</strong> left for kernel launches, the training loop, logging, checkpointing, and networking. That is a thin margin. A 20% faster GPU would need 16.2 cores/GPU and would leave the GPUs waiting on data.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A team doubles GPU performance in their training cluster and keeps the same host CPUs. Name three places the end-to-end speedup could fall short of 2×, and the measurement that would show each one.</p>`,
        a: `<p>Any work the GPU waits for becomes a larger share of the step when only the GPU gets faster (Amdahl's law). Three places to look:</p><ul><li><strong>Data loading and preprocessing:</strong> GPU utilization drops and the data loader's queue sits empty. Profiling shows the GPU idle between steps while loader workers are at 100% CPU.</li><li><strong>Kernel launch and framework overhead:</strong> GPU timelines (Nsight Systems) show gaps between short kernels, and the Python thread that launches them is saturated.</li><li><strong>Communication and synchronization driven by the host:</strong> all-reduces, checkpoint writes, and logging that block the step. The timeline shows the GPU waiting on host-side barriers or storage I/O.</li></ul><p>Each one is fixed on the host side (more or faster cores, GPU-side decode, CUDA Graphs, asynchronous checkpointing), not by a faster GPU.</p>`
      }
    ]
  }
}, [
{
  id: "cpu-ai-why",
  region: "aisys",
  title: "Why CPUs Still Matter for AI",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Chapter 1 (Amdahl's law) and Chapter 7, Domain-Specific Architectures.`,
  sections: [
    { id: "short", label: "The Short Answer" },
    { id: "roles", label: "What the CPU Does in an AI System" },
    { id: "two-kinds", label: "Two Kinds of Work" },
    { id: "amdahl", label: "Amdahl's Law Gets Worse as GPUs Get Faster" },
    { id: "industry", label: "How the Industry Is Responding" },
    { id: "not", label: "Where CPUs Are Not the Answer" }
  ],
  body: `
<p>Almost all the FLOPs in modern AI run on GPUs and other accelerators, so it's natural to assume the CPU no longer matters. It does, and its importance is growing. This page is the big picture. The pages after it put numbers on each part.</p>
<h3 id="sec-short">The Short Answer</h3>
<p>An accelerator is fast at one kind of work: large, regular, parallel arithmetic. Everything else in an AI system lands on the CPU:</p>
<ul>
<li><strong>Control:</strong> the accelerator can't start its own work. Something has to decide what runs, launch it, and react to the result.</li>
<li><strong>Data:</strong> raw data (JPEGs, text, logs, user requests) has to be read, decoded, and shaped before an accelerator can use it.</li>
<li><strong>Memory capacity:</strong> HBM is fast but small. The CPU's DRAM is the next tier, an order of magnitude larger.</li>
<li><strong>Irregular work:</strong> branchy, pointer-chasing, latency-sensitive code like search indexes, databases, compilers, and the tools an agent calls.</li>
</ul>
<p>As accelerators get faster, the time spent in these parts becomes a larger share of the total, so the CPU's speed sets more of the system's speed, not less.</p>
<h3 id="sec-roles">What the CPU Does in an AI System</h3>
<div class="tbl"><table>
<tr><th>Phase</th><th>Accelerator</th><th>CPU</th></tr>
<tr><td>Training</td><td>Forward and backward passes, optimizer step, collectives</td><td><ul><li>Reads and decodes data, applies augmentation, and tokenizes</li><li>Runs the training loop and launches kernels</li><li>Writes checkpoints, logs, and handles failures</li></ul></td></tr>
<tr><td>Inference serving</td><td>Prefill and decode</td><td><ul><li>Accepts requests and tokenizes them</li><li>Schedules batches and allocates KV-cache blocks</li><li>Detokenizes and streams output, enforces stop rules and safety filters</li></ul></td></tr>
<tr><td>Agents and RAG</td><td>Model calls</td><td><ul><li>Runs tools: code execution, tests, compilers, browsers, file parsing</li><li>Searches vector indexes and databases</li><li>Isolates each agent in a container or microVM</li></ul></td></tr>
<tr><td>Small or local models</td><td>Often none</td><td>Runs the whole model with its own vector and matrix units</td></tr>
</table></div>
<h3 id="sec-two-kinds">Two Kinds of Work</h3>
<p>The split follows from how each chip spends its transistors (H&amp;P Chapter 4 and the <a href="#/r/core">Out-of-Order Core</a> region):</p>
<ul>
<li><strong>A GPU hides latency with parallelism.</strong> Thousands of threads wait on memory while others compute. That works when there are thousands of independent, identical operations, as in a matrix multiply.</li>
<li><strong>A CPU reduces latency for one thread.</strong> It does this with branch prediction, out-of-order execution, large caches, and many outstanding misses per core. That works when the next step depends on the last one, as in a graph walk, a parser, a hash join, or an OS system call.</li>
</ul>
<p>A lot of AI system work is the second kind. A vector index walk is a chain of dependent memory accesses. A request scheduler is branchy bookkeeping. An agent's tool call might compile and test a program. None of these have enough regular parallelism to fill a GPU.</p>
<h3 id="sec-amdahl">Amdahl's Law Gets Worse as GPUs Get Faster</h3>
<p>Suppose 10% of a step is serial host work and 90% runs on the GPU (see <a href="#/r/perf/amdahl">Amdahl's Law</a>):</p>
<ul>
<li><strong>GPU 2× faster:</strong> 10% + 90% / 2 = 55% of the original time, a 1.82× speedup.</li>
<li><strong>GPU 10× faster:</strong> 10% + 90% / 10 = 19% of the original time, a 5.3× speedup, and the host is now 10% / 19% ≈ 53% of the step.</li>
<li><strong>GPU infinitely faster:</strong> the step can never get below 10%, a 10× ceiling.</li>
</ul>
<p>GPU throughput for AI has grown much faster than CPU single-thread performance for a decade. So unless the host work is overlapped, moved, or sped up, every GPU generation makes the CPU a larger fraction of the time. This is why serving frameworks spend so much effort on overlapping CPU scheduling with GPU execution, and why <a href="#/llm-hardware/overheads">kernel launches get batched into CUDA Graphs</a>.</p>
<h3 id="sec-industry">How the Industry Is Responding</h3>
<ul>
<li><strong>Tighter CPU-GPU coupling:</strong> NVIDIA's Grace pairs an Arm CPU with each pair of Blackwell GPUs over a coherent 900 GB/s link (<a href="#/grace/c2c">NVLink-C2C</a>), and its successor Vera has 88 custom Arm cores. AMD's MI300A puts 24 Zen 4 cores and the GPU on one package sharing 128 GB of HBM3.</li>
<li><strong>Host-node CPU models:</strong> AMD markets high-frequency EPYC parts (such as the 64-core, 5 GHz EPYC 9575F) specifically as GPU host CPUs, because launch and scheduling overhead depend on single-thread speed. Intel does the same with Xeon 6.</li>
<li><strong>Matrix units inside CPU cores:</strong> Intel's AMX and Arm's SME let a CPU core do small matrix multiplies, so small models run well without a GPU.</li>
<li><strong>Agentic AI:</strong> agents spend much of their time running tools, not generating tokens, and all of that runs on CPUs. CPU vendors argue this will push the number of CPU cores per GPU up. Treat that as a vendor claim, but the arithmetic on <a href="#/cpu-ai-agents">Agents, Tools, and Retrieval</a> shows why it's plausible.</li>
</ul>
<h3 id="sec-not">Where CPUs Are Not the Answer</h3>
<p>None of this means CPUs compete with GPUs on their home ground:</p>
<ul>
<li><strong>Dense math:</strong> a top Xeon's AMX peak is a few hundred TFLOP/s of BF16, against about 1,000 TFLOP/s for an H100 and more for Blackwell. Training and large-batch serving belong on accelerators.</li>
<li><strong>Bandwidth:</strong> a 12-channel CPU socket reaches under 1 TB/s. An H100 reaches 3.35 TB/s, and a B200 8 TB/s.</li>
<li><strong>Energy per FLOP:</strong> a CPU spends most of its energy on the machinery that makes one thread fast (fetch, rename, scheduling), which is wasted on regular matrix math.</li>
</ul>
<p>The right picture is a division of labor: accelerators for dense throughput, CPUs for control, data, capacity, and irregular work. A system is only as fast as the slower of the two.</p>
<p class="refs">Further reading:</p><ul class="refs"><li>Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Chapters 1 and 7</li><li>NVIDIA Grace Hopper Superchip architecture whitepaper (2023)</li><li>AMD Instinct MI300A product brief</li><li>AMD, “EPYC 9005 Series Processors” product page (host-CPU positioning of the 9575F)</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>A training step takes 50 ms: 3 ms of serial host work and 47 ms on the GPU. The next GPU generation is 3× faster, and the host stays the same.</p><ol><li>What is the new step time and end-to-end speedup?</li><li>What share of the step is now host work?</li><li>How much faster would the host need to get to bring its share back to 6%?</li></ol>`,
        a: `<ol><li>New GPU time: 47 ms / 3 = 15.67 ms. New step: 3 ms + 15.67 ms = 18.67 ms. Speedup: 50 ms / 18.67 ms ≈ <strong>2.68×</strong>, not 3×.</li><li>Host share: 3 ms / 18.67 ms ≈ <strong>16.1%</strong>, up from 6%.</li><li>For a 6% share, host time h must satisfy h / (h + 15.67 ms) = 0.06, so h = 0.06 × 15.67 ms / 0.94 ≈ 1.0 ms. The host needs to get 3 ms / 1.0 ms ≈ <strong>3× faster</strong>, the same factor as the GPU. To keep its share constant, the host has to keep pace, which single-thread CPU performance hasn't done for years. In practice the gap is closed by overlapping the host work with the GPU or moving it to the GPU.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A colleague says that since more than 95% of an LLM server's FLOPs run on its GPUs, the choice of host CPU barely matters. Give three ways it does, and for each, a measurable symptom of a host that's too weak.</p>`,
        a: `<p>FLOP share isn't time share. The CPU's work sits on the critical path even when it's a tiny share of the FLOPs.</p><ul><li><strong>Kernel launch rate:</strong> eager decode launches hundreds to thousands of small kernels per step. Symptom: gaps between kernels in the GPU timeline and one CPU thread at 100%. Faster single-thread performance (or CUDA Graphs) closes them.</li><li><strong>Per-step scheduling and sampling:</strong> continuous batching, KV-block allocation, detokenization, and streaming happen every step for every sequence. Symptom: step time grows with batch size faster than GPU kernel time does, and time-per-output-token improves when the scheduler is overlapped with GPU work.</li><li><strong>Memory and I/O:</strong> KV-cache offload, weight loading at startup, and network traffic go through host DRAM and PCIe. Symptom: long model load or cold-start times, and throughput drops when offloaded KV caches are fetched back, with high host memory bandwidth use or PCIe saturation.</li></ul>`
      },
      {
        q: `<p>NVIDIA's GH200 joins a Grace CPU and a Hopper GPU over a coherent 900 GB/s link instead of PCIe. What does this buy an AI workload, and what does it cost?</p>`,
        a: `<p><strong>What it buys:</strong></p><ul><li>About 7× the bandwidth of a PCIe 5.0 x16 link, so the CPU's LPDDR5X becomes a usable second memory tier for KV caches, weights, and optimizer state, not just a staging area.</li><li>Cache coherence and shared page tables, so the GPU can load directly from CPU memory through ordinary pointers. That removes explicit copies and makes oversubscribing HBM practical.</li><li>A CPU designed for this role, with high memory bandwidth per watt, close to the GPU.</li></ul><p><strong>What it costs:</strong></p><ul><li>Flexibility: the CPU is fixed by the vendor, so you can't pick a different host for a workload that needs more cores, more DIMM capacity, or x86 software.</li><li>Fixed memory capacity, since LPDDR5X is on the package with no DIMM slots.</li><li>Ecosystem lock-in to NVIDIA's CPU, link, and software stack.</li></ul>`
      }
    ]
  }
},
{
  id: "cpu-ai-host",
  region: "aisys",
  title: "The CPU as Host",
  sections: [
    { id: "jobs", label: "The Host's Jobs" },
    { id: "configs", label: "Real Head-Node Configurations" },
    { id: "data", label: "Feeding Training: Data Loading" },
    { id: "launch", label: "Kernel Launches and Single-Thread Speed" },
    { id: "serving", label: "The Serving Loop" },
    { id: "links", label: "Moving Data to the GPU" }
  ],
  body: `
<p>A GPU is a coprocessor. It runs what the host tells it to, on data the host put in place. This page puts numbers on how much host is enough.</p>
<h3 id="sec-jobs">The Host's Jobs</h3>
<ul>
<li><strong>Feed data:</strong> read from storage or network, decode, augment, tokenize, batch, and copy into pinned memory for DMA.</li>
<li><strong>Drive the GPU:</strong> run the framework (usually Python), launch kernels, and set up collectives.</li>
<li><strong>Schedule:</strong> in serving, decide which requests join each step, manage KV-cache blocks, and sample or post-process tokens.</li>
<li><strong>Housekeeping:</strong> checkpoints, logging, metrics, health checks, and the network stack, unless the NIC offloads it.</li>
</ul>
<h3 id="sec-configs">Real Head-Node Configurations</h3>
<div class="tbl"><table>
<tr><th>System</th><th>CPUs</th><th>GPUs</th><th>Cores per GPU</th><th>Host memory per GPU</th><th>CPU-GPU link</th></tr>
<tr><td>NVIDIA DGX H100</td><td>2 × Xeon Platinum 8480C (56 cores each)</td><td>8 × H100</td><td>14 cores</td><td>256 GB (2 TB total)</td><td>PCIe 5.0 x16</td></tr>
<tr><td>NVIDIA DGX B200</td><td>2 × Xeon Platinum 8570 (56 cores each)</td><td>8 × B200</td><td>14 cores</td><td>Up to 512 GB (4 TB total)</td><td>PCIe 5.0 x16</td></tr>
<tr><td>NVIDIA GB200 NVL72</td><td>36 × Grace (72 cores each)</td><td>72 × B200</td><td>36 cores</td><td>Up to 240 GB LPDDR5X</td><td>NVLink-C2C, 900 GB/s per Grace</td></tr>
</table></div>
<p>The core count per GPU differs by more than 2× across these systems, and host memory per GPU is a few times the GPU's own HBM. Both of those numbers matter for whether the host keeps up.</p>
<h3 id="sec-data">Feeding Training: Data Loading</h3>
<p>Image and video training is the classic case. Each sample must be read, JPEG-decoded, randomly cropped, resized, flipped, and normalized before the GPU sees it. Suppose a GPU trains a vision model at 5,000 images/s and one core prepares about 150 images/s with a typical CPU pipeline:</p>
<p class="eq">Cores needed = 5,000 images/s / 150 images/s per core ≈ 33 cores/GPU</p>
<p>A DGX H100 has 14 cores/GPU. With only the CPU preparing data, the GPU gets 14 cores × 150 images/s per core = 2,100 images/s, so it's busy only 2,100 / 5,000 = 42% of the time. Mohan et al. measured exactly this kind of “data stall” across many models, with several to a couple dozen cores per GPU needed for preprocessing. The fixes:</p>
<ul>
<li>Decode on the GPU (nvJPEG and NVIDIA DALI) or on dedicated hardware decoders.</li>
<li>Store data pre-decoded or pre-resized, trading storage for CPU time.</li>
<li>Cache decoded samples in host DRAM across epochs, which needs memory capacity.</li>
<li>Disaggregate preprocessing to a separate CPU fleet. Meta reported that for some recommendation models, the storage and preprocessing fleet draws more power than the GPU trainers.</li>
</ul>
<p>LLM pretraining is lighter, since data is usually pre-tokenized. Multimodal training brings the image and video problem back.</p>
<h3 id="sec-launch">Kernel Launches and Single-Thread Speed</h3>
<p>Each kernel launch costs a few microseconds of CPU and driver time on one thread. Launches are asynchronous, so the CPU can run ahead of the GPU. That works while the average kernel runs longer than the launch takes. Once kernels get shorter than that, the GPU waits on the CPU:</p>
<p class="eq">Step time ≈ max( N<sub>kernels</sub> × t<sub>launch</sub>, Σ t<sub>kernel</sub> )</p>
<p>LLM decode at small batch is the worst case: about a thousand short kernels per token, many of them a few microseconds long (see <a href="#/llm-hardware/overheads">One Token Through the Hardware</a>). The standard fixes are CUDA Graphs (record the step once and replay it with one launch), kernel fusion (fewer, bigger kernels), and compiling the model (torch.compile, TensorRT). Whatever is left still runs on one CPU thread, which is why host CPUs for GPU servers favor high clock speeds over core count.</p>
<h3 id="sec-serving">The Serving Loop</h3>
<p>An LLM server with continuous batching runs a loop every decode step: pick which requests run, allocate KV-cache blocks, launch the step, wait for logits, sample, detokenize, stream tokens out, and retire finished requests. Much of that work grows with batch size. Suppose a step does 20 ms of GPU work and 4 ms of host work:</p>
<ul>
<li><strong>Serialized:</strong> 20 ms + 4 ms = 24 ms per step, so the host costs 17% of throughput.</li>
<li><strong>Overlapped</strong> (schedule step k + 1 while the GPU runs step k): max(20 ms, 4 ms) = 20 ms per step.</li>
<li><strong>Next-generation GPU, 2× faster:</strong> serialized gives 10 ms + 4 ms = 14 ms, a speedup of only 1.71×. Overlapped gives max(10 ms, 4 ms) = 10 ms, the full 2×. At a 5× faster GPU, even the overlapped loop is host-bound (max(4 ms, 4 ms)).</li>
</ul>
<p>This is why recent versions of vLLM and SGLang reworked their schedulers for asynchronous, overlapped execution: the serving loop's CPU time had become a first-order bottleneck on fast GPUs.</p>
<h3 id="sec-links">Moving Data to the GPU</h3>
<ul>
<li><strong>PCIe 5.0 x16:</strong> about 64 GB/s per direction, often 50 to 55 GB/s achieved. Copies must come from pinned (page-locked) host memory to run as DMA at full speed.</li>
<li><strong>NVLink-C2C:</strong> 450 GB/s per direction and coherent, so host memory behaves like a slower extension of HBM (see <a href="#/grace/c2c">Grace</a>).</li>
<li><strong>Bypassing the CPU:</strong> GPUDirect RDMA moves network data straight into GPU memory, and GPUDirect Storage does the same for NVMe. The CPU still sets up the transfer but no longer copies the bytes, which frees its memory bandwidth.</li>
</ul>
<p class="refs">Further reading:</p><ul class="refs"><li>NVIDIA DGX H100 and DGX B200 user guides (system specifications)</li><li>Mohan et al., “Analyzing and Mitigating Data Stalls in DNN Training” (VLDB 2021)</li><li>Zhao et al., “Understanding Data Storage and Ingestion for Large-Scale Deep Recommendation Model Training” (ISCA 2022)</li><li>NVIDIA, “Getting Started with CUDA Graphs” (developer blog)</li><li>vLLM blog, “vLLM v0.6.0: 2.7x Throughput Improvement and 5x Latency Reduction” (2024), on CPU overhead in serving</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>An 8-GPU server has 2 CPUs with 48 cores each. Each GPU trains a vision model at 7,200 images/s, and preprocessing costs 4.5 ms of core time per image.</p><ol><li>How many cores per GPU does preprocessing need?</li><li>If preprocessing runs only on the host CPUs, what GPU utilization results?</li></ol>`,
        a: `<ol><li>Demand: 7,200 images/s × 4.5 ms/image = 32.4 cores/GPU (core-seconds per second).</li><li>Available: 2 CPUs × 48 cores/CPU / 8 GPUs = 12 cores/GPU. Delivered rate: 12 cores / 4.5 ms per image ≈ 2,667 images/s. Utilization: 2,667 images/s / 7,200 images/s ≈ <strong>37%</strong>. Even with every host core on preprocessing and nothing left for the training loop, the GPUs are idle almost two-thirds of the time. GPU-side decode or pre-decoded data is required.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A decode step launches 1,200 kernels from one host thread. Each launch costs 4 µs of CPU time, and the kernels average 2.5 µs of GPU time each.</p><ol><li>Estimate the step time with eager launches and with a CUDA Graph.</li><li>A faster host CPU cuts launch cost to 3 µs. How much does that help the eager case, and what launch cost would make eager launches stop mattering?</li></ol><p class="given">Assume all kernels run back to back in one stream, a CUDA Graph launch costs 15 µs and then runs the kernels with no gaps, and the step ends with a synchronization so no launches overlap the next step.</p>`,
        a: `<ol><li><strong>Eager:</strong> launches take 4 µs/kernel and kernels take 2.5 µs/kernel, so the GPU drains its queue faster than the CPU fills it. The CPU sets the pace: about 1,200 kernels × 4 µs/kernel = 4.8 ms, plus 2.5 µs for the last kernel, ≈ <strong>4.8 ms</strong>. <strong>Graph:</strong> 15 µs + 1,200 kernels × 2.5 µs/kernel = 15 µs + 3,000 µs ≈ <strong>3.0 ms</strong>, a 1.6× speedup.</li><li>At 3 µs per launch, eager takes 1,200 kernels × 3 µs/kernel = 3.6 ms, still launch-bound and 20% slower than the graph. Launches stop mattering only when t<sub>launch</sub> ≤ 2.5 µs, the average kernel time. Single-thread speedups help in proportion, but removing launches (graphs, fusion) works regardless of the CPU.</li></ol>`
      },
      {
        q: `<p>An LLM server at batch 256 runs 24 ms of GPU work per decode step. Host work per step is 0.8 ms of fixed overhead plus 0.03 ms per sequence (scheduling, sampling, detokenizing, streaming).</p><ol><li>Compute the throughput in tokens/s with serialized and with overlapped host work.</li><li>A new GPU cuts GPU time per step by a factor s. At what s does the overlapped server become host-bound, and what throughput does it reach there?</li></ol><p class="given">Assume each sequence produces 1 token per step, host work per step doesn't depend on the GPU, and overlapped execution gives a step time of max(GPU time, host time).</p>`,
        a: `<ol><li>Host time: 0.8 ms + 256 sequences × 0.03 ms/sequence = 0.8 ms + 7.68 ms = 8.48 ms. <strong>Serialized:</strong> 24 ms + 8.48 ms = 32.48 ms per step, so 256 tokens / 32.48 ms ≈ <strong>7,880 tokens/s</strong>. <strong>Overlapped:</strong> max(24 ms, 8.48 ms) = 24 ms per step, so 256 tokens / 24 ms ≈ <strong>10,670 tokens/s</strong>.</li><li>Host-bound when 24 ms / s ≤ 8.48 ms, so s ≥ 24 ms / 8.48 ms ≈ <strong>2.83</strong>. At that point the step takes 8.48 ms and throughput is 256 tokens / 8.48 ms ≈ <strong>30,190 tokens/s</strong>. Any faster GPU is wasted unless host time drops. Since most of the host time scales with batch size (7.68 ms of 8.48 ms), per-sequence host cost is the number to cut, for example by vectorizing sampling on the GPU or parallelizing detokenization across cores.</li></ol>`
      }
    ]
  }
},
{
  id: "cpu-ai-infer",
  region: "aisys",
  title: "Running Models on the CPU",
  sections: [
    { id: "when", label: "When CPU Inference Makes Sense" },
    { id: "units", label: "Matrix Engines in CPU Cores" },
    { id: "roofline", label: "The CPU Roofline" },
    { id: "decode", label: "Decode on the CPU" },
    { id: "prefill", label: "Prefill on the CPU" },
    { id: "breaks", label: "Where It Breaks Down" }
  ],
  body: `
<p>Most of the world's inference has historically run on CPUs. In 2018, Facebook reported that the bulk of its inference ran on CPUs, because it was already deployed everywhere and the models were small enough. LLMs moved the center of gravity to GPUs, but CPU inference is still the right answer for a large class of workloads, and the roofline model shows exactly which.</p>
<h3 id="sec-when">When CPU Inference Makes Sense</h3>
<ul>
<li><strong>Small models:</strong> embedding models, rerankers, classifiers, speech models, and LLMs up to a few billion parameters.</li>
<li><strong>Low batch and low duty cycle:</strong> a model called occasionally doesn't justify a GPU sitting idle.</li>
<li><strong>Data locality:</strong> the model runs next to a database or inside an application, avoiding a network hop to a GPU service.</li>
<li><strong>Capacity:</strong> a CPU socket holds terabytes of DRAM, so large models fit without splitting across GPUs, at the cost of speed.</li>
<li><strong>Availability and cost:</strong> CPUs are already in every server, laptop, and phone.</li>
</ul>
<h3 id="sec-units">Matrix Engines in CPU Cores</h3>
<p>CPUs have added matrix hardware in three steps:</p>
<ul>
<li><strong>Wide SIMD:</strong> AVX-512 and Arm SVE do 16 FP32 lanes per instruction.</li>
<li><strong>Dot-product instructions:</strong> AVX-512 VNNI and AVX-512 BF16 fuse multiply and accumulate across 8-bit or 16-bit pairs, doubling or quadrupling throughput per instruction.</li>
<li><strong>Matrix units:</strong> Intel AMX (since Sapphire Rapids) adds 8 tile registers of 16 rows × 64 bytes and a tile multiply unit (TMUL). Intel rates it at 1,024 BF16 FLOP/cycle and 2,048 INT8 ops/cycle per core, 8× AVX-512 VNNI. Arm's SME and SME2 add a comparable outer-product engine (Apple M4, Arm C1 cores).</li>
</ul>
<p>The matrix unit sits next to the core's caches, so small matrix multiplies don't pay the cost of a PCIe round trip to an accelerator.</p>
<h3 id="sec-roofline">The CPU Roofline</h3>
<p>Take an Intel Xeon 6980P: 128 cores with AMX, at a 2.0 GHz base clock, and 12 channels of MRDIMM-8800.</p>
<ul>
<li><strong>Peak BF16:</strong> 128 cores × 1,024 FLOP/cycle × 2.0 GHz ≈ 262 TFLOP/s (theoretical, since sustained AMX clocks are often lower).</li>
<li><strong>Bandwidth:</strong> 12 channels × 8 bytes × 8.8 GT/s ≈ 845 GB/s.</li>
<li><strong>Ridge point:</strong> 262 TFLOP/s / 845 GB/s ≈ 310 FLOP/byte.</li>
</ul>
<p>An H100's ridge is about 989 TFLOP/s / 3.35 TB/s ≈ 295 FLOP/byte. The two rooflines have nearly the same shape, and the CPU's is about 4× lower on both axes. So the CPU isn't weak at one kind of work in particular. It's uniformly a few times slower than a GPU, and much cheaper and more available. See <a href="#/perf-roofline">The Roofline Model</a> for the method.</p>
<h3 id="sec-decode">Decode on the CPU</h3>
<p>Decode at batch 1 reads every weight once per token (see <a href="#/llm-phases">Prefill and Decode</a>), so the bound is bandwidth over model bytes. On the Xeon 6980P above, for Llama 3.1 8B:</p>
<ul>
<li><strong>BF16 (16 GB):</strong> 845 GB/s / 16 GB per token ≈ 53 tokens/s.</li>
<li><strong>4-bit (about 4.5 bits per weight with scales, 4.5 GB):</strong> 845 GB/s / 4.5 GB per token ≈ 188 tokens/s.</li>
<li><strong>Llama 3.1 70B in 4-bit (about 39 GB):</strong> 845 GB/s / 39 GB per token ≈ 22 tokens/s, faster than people read, on a model that needs at least 2 GPUs in BF16.</li>
</ul>
<p>Real implementations (llama.cpp, OpenVINO, IPEX) reach a fraction of this, typically 50 to 80% of peak bandwidth, and less across NUMA boundaries. A 6980P is three compute dies, and a two-socket server is two NUMA nodes, so weights must be placed so each core reads from its own node (see <a href="#/icx-fabrics/numa">NUMA</a>).</p>
<h3 id="sec-prefill">Prefill on the CPU</h3>
<p>Prefill is compute-bound, about 2 FLOPs per parameter per prompt token. For Llama 3.1 8B and a 2,000-token prompt: 2 FLOP × 8 × 10<sup>9</sup> parameters × 2,000 tokens = 32 TFLOP.</p>
<ul>
<li><strong>Xeon 6980P at 50% of peak (131 TFLOP/s):</strong> 32 TFLOP / 131 TFLOP/s ≈ 0.24 s to first token.</li>
<li><strong>H100 at 60% of peak (593 TFLOP/s):</strong> 32 TFLOP / 593 TFLOP/s ≈ 54 ms.</li>
</ul>
<p>A quarter second is fine for a chatbot with short prompts. For a 100,000-token RAG prompt, it becomes 12 s or more on the CPU, which is where CPU inference stops being practical.</p>
<h3 id="sec-breaks">Where It Breaks Down</h3>
<ul>
<li><strong>Long prompts:</strong> prefill cost grows with prompt length, and the CPU's compute ceiling is several times lower.</li>
<li><strong>High concurrency:</strong> batching raises the GPU's throughput much more, because its compute ceiling is higher. And as this page's practice shows, the KV cache keeps CPU decode bandwidth-bound at every batch size.</li>
<li><strong>Large models in BF16:</strong> capacity fits, but tokens/s falls in proportion to model bytes.</li>
</ul>
<p>Mixed designs get the best of both: some systems run attention and dense layers on a GPU and keep a mixture-of-experts model's rarely used experts in CPU memory, computing those on the CPU with AMX (as KTransformers does for DeepSeek models).</p>
<p class="refs">Further reading:</p><ul class="refs"><li>Hazelwood et al., “Applied Machine Learning at Facebook: A Datacenter Infrastructure Perspective” (HPCA 2018)</li><li>Intel, “Intel Advanced Matrix Extensions (Intel AMX)” overview and the Intel 64 and IA-32 Architectures Optimization Reference Manual</li><li>Intel Xeon 6 6900P-series product specifications</li><li>Arm, “Scalable Matrix Extension” architecture introduction</li><li>Williams, Waterman, and Patterson, “Roofline: An Insightful Visual Performance Model” (CACM 2009)</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>An AMD EPYC 9655 has 96 Zen 5 cores at 2.6 GHz and 12 channels of DDR5-6000. It serves Mistral 7B (7.3 billion parameters) with INT8 weights.</p><ol><li>What is the decode bound at batch 1, and what do you expect at 70% bandwidth efficiency?</li><li>How long does prefill of a 1,500-token prompt take at peak compute?</li></ol><p class="given">Assume each core sustains 128 BF16 FLOP/cycle with AVX-512 BF16, weights are dequantized to BF16 on the fly, and the KV cache traffic is negligible at this context length.</p>`,
        a: `<ol><li>Bandwidth: 12 channels × 8 bytes × 6.0 GT/s = 576 GB/s. Weights: 7.3 × 10<sup>9</sup> parameters × 1 byte = 7.3 GB per token. Bound: 576 GB/s / 7.3 GB per token ≈ <strong>79 tokens/s</strong>, and at 70% efficiency about <strong>55 tokens/s</strong>.</li><li>Peak compute: 96 cores × 128 FLOP/cycle × 2.6 GHz ≈ 31.9 TFLOP/s. Prefill: 2 FLOP × 7.3 × 10<sup>9</sup> parameters × 1,500 tokens = 21.9 TFLOP. Time: 21.9 TFLOP / 31.9 TFLOP/s ≈ <strong>0.69 s</strong>. Without a matrix unit, this CPU's ridge is only 31.9 TFLOP/s / 576 GB/s ≈ 55 FLOP/byte, so prefill hits the compute ceiling early. That ceiling is what AMX and SME raise.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A Xeon 6 server socket serves Llama 3.1 8B with INT8 weights (8 GB) at 4,096 tokens of context per sequence. Does batching ever make decode compute-bound, and what is the throughput ceiling?</p><p class="given">Assume 96 cores × 1,024 BF16 FLOP/cycle with AMX at 1.9 GHz, 12 channels of DDR5-6400, 2 FLOPs per parameter per token, a BF16 KV cache of 32 layers × 8 KV heads × 128 dimensions × 2 (K and V) × 2 bytes per token, attention FLOPs ignored, and that each step reads the weights once for the whole batch and each sequence's full KV cache.</p>`,
        a: `<ol><li>Peak: 96 cores × 1,024 FLOP/cycle × 1.9 GHz ≈ 186.8 TFLOP/s. Bandwidth: 12 channels × 8 bytes × 6.4 GT/s ≈ 614 GB/s. Ridge: 186.8 TFLOP/s / 614 GB/s ≈ 304 FLOP/byte.</li><li>KV cache per token: 32 × 8 × 128 × 2 × 2 bytes = 131,072 bytes. Per sequence at 4,096 tokens: 4,096 tokens × 131,072 bytes/token ≈ 0.537 GB read every step.</li><li>Per step at batch B: FLOPs = 2 FLOP × 8 × 10<sup>9</sup> parameters × B = 16 GFLOP × B. Bytes = 8 GB + 0.537 GB × B. Intensity = 16B / (8 + 0.537B) FLOP/byte, which rises toward 16 / 0.537 ≈ 29.8 FLOP/byte as B grows.</li><li>That limit is about 10× below the 304 FLOP/byte ridge, so <strong>decode never becomes compute-bound</strong>. Batching shares the weight reads but not the KV reads.</li><li>Throughput = B tokens per step / ((8 GB + 0.537 GB × B) / 614 GB/s). At B = 16: 16 tokens / (16.6 GB / 614 GB/s) ≈ 590 tokens/s. The ceiling as B grows is 614 GB/s / 0.537 GB per token ≈ <strong>1,140 tokens/s</strong>. To go higher, shrink the KV cache (FP8 or INT8 KV, shorter contexts) rather than adding cores.</li></ol>`
      },
      {
        q: `<p>Decode on a two-socket CPU server often gets well under 2× the throughput of one socket. Explain why, and describe how you would lay out the model so both sockets help.</p>`,
        a: `<p>Decode is bandwidth-bound, so throughput depends on each core reading weights from <strong>local</strong> DRAM. With default allocation, pages land on whichever node touched them first (often one socket), so half the cores read across the socket link (UPI or Infinity Fabric). That link has a fraction of local DRAM bandwidth and adds latency, so the remote half runs far slower. Threads that migrate between sockets make it worse.</p><p>Layout that works: treat the two sockets like two GPUs with <strong>tensor parallelism</strong>. Split each weight matrix in half, pin each half to its socket's memory (numactl or explicit first-touch), and pin each socket's threads to its own cores. Each socket then reads only its local half of the weights, so aggregate bandwidth doubles. The cost is an all-reduce of the activation vector across the socket link twice per layer. At batch 1, that's a few KB per layer, small next to the weights, but it's a latency hit per layer. The same reasoning applies within one socket that has sub-NUMA clustering.</p>`
      }
    ]
  }
},
{
  id: "cpu-ai-agents",
  region: "aisys",
  title: "Agents, Tools, and Retrieval",
  sections: [
    { id: "loop", label: "From Chatbots to Agents" },
    { id: "demand", label: "A Model of CPU Demand per GPU" },
    { id: "sandbox", label: "Sandboxes and Isolation" },
    { id: "vector", label: "Retrieval and Vector Search" },
    { id: "design", label: "What This Means for Server Design" }
  ],
  body: `
<p>A chatbot spends nearly all its time in the model. An agent alternates between the model and the outside world, and the outside world runs on CPUs. This is the main reason CPU demand per GPU is expected to rise.</p>
<h3 id="sec-loop">From Chatbots to Agents</h3>
<p>An agent repeats a loop:</p>
<ol>
<li>The model reads the context and generates an action, such as a tool call.</li>
<li>The system runs the tool: execute code, run tests, compile, query a database, fetch and parse a web page, read a PDF.</li>
<li>The tool's output is appended to the context, and the loop repeats.</li>
</ol>
<p>Step 1 is GPU work. Step 2 is ordinary software, often heavy (a test suite, a build, a headless browser), and it runs on CPUs. Retrieval-augmented generation (RAG) adds another CPU-heavy step before the model call: search an index for relevant documents.</p>
<h3 id="sec-demand">A Model of CPU Demand per GPU</h3>
<p>Treat one GPU as a token factory serving many agents at once. Suppose:</p>
<ul>
<li>The GPU produces 2,400 tokens/s in aggregate across its concurrent sequences.</li>
<li>Each agent step generates 400 tokens, then runs a tool for 3 core-seconds.</li>
<li>Each sequence decodes at 30 tokens/s.</li>
</ul>
<p>Then:</p>
<ul>
<li><strong>Steps per second:</strong> 2,400 tokens/s / 400 tokens/step = 6 steps/s per GPU.</li>
<li><strong>CPU demand:</strong> 6 steps/s × 3 core-seconds/step = 18 cores busy per GPU, more than the 14 cores/GPU in a DGX H100, before any host overhead.</li>
<li><strong>Agents in flight (Little's law):</strong> each step takes 400 tokens / 30 tokens/s ≈ 13.3 s on the GPU plus 3 s in the tool, so 6 steps/s × 16.3 s ≈ 98 agents must be active to keep the GPU busy. About 80 of them are decoding and 18 are running tools at any moment.</li>
</ul>
<p>If the CPUs fall short, tools queue, agents wait, fewer sequences are decoding, and the GPU's batch shrinks. The GPU then runs at lower throughput even though it's the expensive part. Two things make it worse: tools vary widely (a lint run takes milliseconds, a full test suite takes minutes), and every returning agent brings a longer context that must be prefilled or restored (see <a href="#/cpu-ai-memory/kv">KV-cache offload</a>).</p>
<h3 id="sec-sandbox">Sandboxes and Isolation</h3>
<p>Agents run untrusted, model-written code, so each needs isolation: a container, a gVisor sandbox, or a microVM such as Firecracker, which AWS reports boots in about 125 ms with a few MB of overhead. That isolation is CPU and OS work:</p>
<ul>
<li>Creating and tearing down sandboxes (process creation, page-table setup, file-system layers).</li>
<li>System calls and context switches, which are more expensive under gVisor or a VM (see <a href="#/r/os">Kernel Entry</a>).</li>
<li>Memory per sandbox, which limits how many agents fit in host DRAM.</li>
</ul>
<h3 id="sec-vector">Retrieval and Vector Search</h3>
<p>RAG embeds documents as vectors and finds the nearest ones to a query vector. Brute force reads every vector. For 20 million chunks of 768-dimensional FP32 embeddings:</p>
<p class="eq">20 × 10<sup>6</sup> vectors × 768 dimensions × 4 bytes = 61.4 GB per query</p>
<p>At 845 GB/s on a high-end socket, that's about 73 ms per query, bandwidth-bound. Production systems use approximate indexes instead:</p>
<ul>
<li><strong>Graph indexes (HNSW):</strong> walk a proximity graph greedily toward the query. Each hop loads a node's neighbor list, then those neighbors' vectors, so a query visits a few thousand vectors in a chain of dependent memory accesses.</li>
<li><strong>Inverted-file indexes (IVF, often with product quantization):</strong> scan only the few clusters nearest the query, with compressed vectors.</li>
</ul>
<p>A graph walk is the kind of work CPUs are built for: dependent loads, branchy heap updates, and large working sets that need DRAM capacity. Its speed depends on memory latency and memory-level parallelism (see <a href="#/latency-tolerance/mlp">memory-level parallelism</a>), not FLOPs. GPUs win for large batches of queries with brute-force or IVF search (FAISS on GPU), where the work becomes a matrix multiply. Many deployments keep the index on CPUs because it's tens to hundreds of GB and serves queries one at a time.</p>
<h3 id="sec-design">What This Means for Server Design</h3>
<ul>
<li><strong>More cores per GPU:</strong> NVIDIA's Vera (88 cores per CPU) and CPU vendors' agentic-AI messaging both point the same way. The demand model above is how to check a vendor's claim against your own workload.</li>
<li><strong>Separate CPU pools:</strong> tool execution can run on a separate CPU cluster instead of the GPU servers' hosts, at the cost of a network hop per tool call.</li>
<li><strong>Memory capacity:</strong> sandboxes, indexes, and offloaded KV caches all compete for host DRAM.</li>
</ul>
<p class="refs">Further reading:</p><ul class="refs"><li>Yao et al., “ReAct: Synergizing Reasoning and Acting in Language Models” (ICLR 2023), the basic agent loop</li><li>Malkov and Yashunin, “Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs” (IEEE TPAMI 2020)</li><li>Johnson, Douze, and Jégou, “Billion-Scale Similarity Search with GPUs” (IEEE Transactions on Big Data 2021), the FAISS paper</li><li>Agache et al., “Firecracker: Lightweight Virtualization for Serverless Applications” (NSDI 2020)</li><li>NVIDIA, Vera Rubin platform announcement (GTC 2025)</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>A coding-agent service runs on 8-GPU servers with 2 × 64-core CPUs. Each GPU produces 3,600 tokens/s in aggregate. Each agent step generates 250 tokens, then runs tests for 1.2 core-seconds. Do the host CPUs keep up?</p><p class="given">Assume tools run on the same server's CPUs and need no other host work.</p>`,
        a: `<ol><li>Steps per GPU: 3,600 tokens/s / 250 tokens/step = 14.4 steps/s.</li><li>CPU demand: 14.4 steps/s × 1.2 core-seconds/step ≈ 17.3 cores/GPU.</li><li>Supply: 2 CPUs × 64 cores/CPU / 8 GPUs = 16 cores/GPU.</li><li><strong>No.</strong> Even before kernel launches and scheduling, the tools need about 1.3 cores/GPU more than exist. Agents queue for tools, fewer of them are decoding, and the GPUs lose throughput. Options are more host cores, a separate CPU pool for tools, or cheaper tools (incremental test runs).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A RAG service searches 50 million 1,024-dimensional INT8 vectors by brute force on a two-socket server.</p><ol><li>What is the maximum queries/s with one query at a time?</li><li>Batching Q queries lets one pass over the database serve all of them. At what Q does the scan become compute-bound, and what is the compute-bound queries/s?</li><li>When would you use a graph index instead?</li></ol><p class="given">Assume 2 sockets × 576 GB/s of DRAM bandwidth, 2 sockets × 96 cores × 256 INT8 ops/cycle with AVX-512 VNNI at 2.5 GHz, 2 ops (multiply and add) per dimension per query-vector pair, and that the batch's queries stay in cache.</p>`,
        a: `<ol><li>Database: 50 × 10<sup>6</sup> vectors × 1,024 bytes = 51.2 GB per pass. Bandwidth: 2 × 576 GB/s = 1,152 GB/s. One query at a time: 1,152 GB/s / 51.2 GB per query ≈ <strong>22.5 queries/s</strong>.</li><li>Compute: 2 × 96 cores × 256 ops/cycle × 2.5 GHz ≈ 122.9 Tops/s. Ridge: 122.9 Tops/s / 1,152 GB/s ≈ 107 ops/byte. Intensity with batch Q: (2 ops × 1,024 dimensions × Q) / 1,024 bytes = 2Q ops/byte, so it's compute-bound at <strong>Q ≈ 53</strong>. Compute-bound rate: 122.9 Tops/s / (2 ops × 1,024 dimensions × 50 × 10<sup>6</sup> vectors) ≈ <strong>1,200 queries/s</strong>. The cost is latency: each query waits for its batch to fill and then for a full pass, 51.2 GB / 1,152 GB/s ≈ 44 ms.</li><li>A graph index visits a few thousand vectors per query instead of 50 million, so per-query work drops by about 10,000×. Use it when queries arrive one at a time with tight latency targets and a recall around 95% is acceptable. Brute force stays attractive when exact results are required or queries naturally come in large batches, which also suits a GPU.</li></ol>`
      },
      {
        q: `<p>For an agent fleet, which matters more on the host: single-thread speed or core count? Answer separately for the tool-execution path and for the GPU-driving path.</p>`,
        a: `<ul><li><strong>Tool execution:</strong> mostly core count and memory capacity. Many independent agents run tools at once, so this is throughput work. Single-thread speed affects each agent's latency, which matters when a tool sits on the critical path of a user-facing task (a compile or a test run that the user is waiting on).</li><li><strong>Driving the GPU:</strong> single-thread speed. Kernel launches, the scheduler loop, and sampling run on one or a few threads per GPU, and they gate every decode step. A slow host thread lowers GPU throughput for every agent at once.</li></ul><p>That's why the best fit is a mix: a few fast cores per GPU for the driver path, plus many efficient cores (on the same host or a separate pool) for tools. Vendors' split of high-frequency host CPUs and dense-core CPUs reflects the same divide.</p>`
      }
    ]
  }
},
{
  id: "cpu-ai-memory",
  region: "aisys",
  title: "The CPU as a Memory Tier",
  sections: [
    { id: "gap", label: "The Capacity Gap" },
    { id: "kv", label: "Offloading the KV Cache" },
    { id: "train", label: "Offloading Weights and Optimizer State" },
    { id: "coherent", label: "Coherent CPU-GPU Memory" },
    { id: "recsys", label: "Recommendation Embeddings" }
  ],
  body: `
<p>HBM is fast and small. The CPU's DRAM is slower and an order of magnitude larger. Much of modern AI system design is deciding which state lives in which tier, and the CPU owns the big one.</p>
<h3 id="sec-gap">The Capacity Gap</h3>
<div class="tbl"><table>
<tr><th>Tier</th><th>Capacity (DGX H100 scale)</th><th>Bandwidth to the GPU</th></tr>
<tr><td>GPU HBM3</td><td>80 GB per GPU</td><td>3.35 TB/s</td></tr>
<tr><td>Host DDR5</td><td>2 TB per server, 256 GB per GPU</td><td>PCIe 5.0 x16, about 55 GB/s achieved per direction</td></tr>
<tr><td>CXL memory expanders</td><td>Hundreds of GB to TBs more</td><td>Through the CPU, with tens of ns more latency than local DRAM (see <a href="#/icx-links/cxl">CXL</a>)</td></tr>
<tr><td>Local NVMe</td><td>Tens of TB</td><td>A few GB/s per drive</td></tr>
</table></div>
<p>The pattern to remember: each step down is roughly 3× to 60× less bandwidth and 10× more capacity. Offloading works when the data is reused rarely enough, or is cheaper to fetch than to recompute.</p>
<h3 id="sec-kv">Offloading the KV Cache</h3>
<p>Every sequence's keys and values stay in memory for its whole lifetime (see <a href="#/llm-kvcache/size">KV Cache Size</a>). For Llama 3.1 70B in BF16, that's 80 layers × 8 KV heads × 128 dimensions × 2 (K and V) × 2 bytes = 327,680 bytes per token. A 32,768-token conversation holds 32,768 tokens × 327,680 bytes/token ≈ 10.7 GB.</p>
<p>When the user pauses, or an agent goes off to run a tool, keeping 10.7 GB in HBM blocks other requests. Dropping it means recomputing it with a full prefill when the conversation resumes. Moving it to host DRAM is often the better third option:</p>
<ul>
<li><strong>Restore over PCIe:</strong> 10.7 GB / 55 GB/s ≈ 195 ms (less if spread over 8 GPUs' links in parallel).</li>
<li><strong>Restore over NVLink-C2C:</strong> 10.7 GB / 450 GB/s ≈ 24 ms.</li>
<li><strong>Recompute:</strong> 2 FLOP × 70 × 10<sup>9</sup> parameters × 32,768 tokens ≈ 4.6 PFLOP. On 8 H100s at 50% of 989 TFLOP/s each (3.96 PFLOP/s), that's about 1.16 s, plus attention FLOPs that grow with the square of the context.</li>
</ul>
<p>Restoring from host DRAM beats recomputing by 6× here, and the gap grows with context length. This is why serving stacks such as vLLM (CPU offload), LMCache, and NVIDIA Dynamo's KV block manager tier the KV cache into host memory and then SSD. It's also why host DRAM capacity per GPU, not just core count, is part of an inference server's specification.</p>
<h3 id="sec-train">Offloading Weights and Optimizer State</h3>
<p>Mixed-precision training with Adam keeps about 16 bytes per parameter: 2 bytes of BF16 weights, 2 bytes of gradients, and 12 bytes of FP32 master weights and two moments. A 13-billion-parameter model needs 13 × 10<sup>9</sup> parameters × 16 bytes ≈ 208 GB, far more than one GPU's HBM.</p>
<p>ZeRO-Offload keeps the 12 bytes per parameter of optimizer state in host memory and runs the Adam update on the CPU, sending gradients down and updated weights back over PCIe each step. Its authors trained 13-billion-parameter models on a single V100. ZeRO-Infinity extends the idea to NVMe. The Adam update is a streaming, element-wise operation with very low arithmetic intensity, which is exactly the kind of work where a CPU's bandwidth is enough and its compute isn't wasted.</p>
<p>Inference uses the same idea for mixture-of-experts models: rarely activated experts stay in CPU memory and run on the CPU (see <a href="#/cpu-ai-infer/breaks">Running Models on the CPU</a>).</p>
<h3 id="sec-coherent">Coherent CPU-GPU Memory</h3>
<p>Over PCIe, offloading is explicit copying. Coherent links change that. In GH200, a Grace CPU with up to 480 GB of LPDDR5X joins a Hopper GPU over NVLink-C2C. The GPU can load host memory directly through the same page tables, at 450 GB/s per direction (see <a href="#/grace/c2c">Grace</a>). AMD's MI300A goes further, with CPU and GPU sharing one pool of HBM3. Both make the CPU's memory a natural extension of the GPU's, with the CPU's cores free to do the bookkeeping.</p>
<h3 id="sec-recsys">Recommendation Embeddings</h3>
<p>Recommendation models (Meta's DLRM is the reference design) map each sparse feature, such as a user or item ID, to a row of a huge embedding table. The tables reach terabytes, and Meta has described production models with up to 12 trillion parameters, mostly embeddings. Each lookup is a random gather of a small row, so the work is capacity- and latency-bound, not FLOP-bound. That's why recommendation inference long ran mostly on CPUs, and why training systems shard tables across many GPUs' HBM and tier the largest into host memory.</p>
<p class="refs">Further reading:</p><ul class="refs"><li>Ren et al., “ZeRO-Offload: Democratizing Billion-Scale Model Training” (USENIX ATC 2021)</li><li>Rajbhandari et al., “ZeRO-Infinity: Breaking the GPU Memory Wall for Extreme Scale Deep Learning” (SC 2021)</li><li>Naumov et al., “Deep Learning Recommendation Model for Personalization and Recommendation Systems” (2019)</li><li>Mudigere et al., “Software-Hardware Co-design for Fast and Scalable Training of Deep Learning Recommendation Models” (ISCA 2022)</li><li>NVIDIA Dynamo documentation, KV block manager</li><li>LMCache project documentation</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>Llama 3.1 405B has 126 layers, 8 KV heads, and a head dimension of 128, with a BF16 KV cache. A 16,384-token conversation is offloaded to host DRAM. How big is its KV cache, and how long does restoring it take over a link that achieves 100 GB/s?</p>`,
        a: `<ol><li>Per token: 126 layers × 8 heads × 128 dimensions × 2 (K and V) × 2 bytes = 516,096 bytes ≈ 504 KiB/token.</li><li>Per conversation: 16,384 tokens × 516,096 bytes/token ≈ 8.46 GB.</li><li>Restore: 8.46 GB / 100 GB/s ≈ <strong>85 ms</strong>. That's about one prefill chunk's worth of time, and far less than recomputing 16,384 tokens through a 405B model.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Llama 3.1 70B is served on 8 B200 GPUs. A paused conversation's KV cache can be restored from host DRAM, restored from local NVMe, or recomputed. Per token of context, which is fastest, and how many NVMe drives would make the SSD tier beat recomputing?</p><p class="given">Assume a BF16 KV cache of 327,680 bytes/token, 2,250 TFLOP/s of dense BF16 per B200 at 50% utilization, 2 FLOPs per parameter per token for prefill with attention FLOPs ignored, each GPU restoring its eighth of the cache over its own PCIe 6.0 x16 link at 100 GB/s, and NVMe drives at 14 GB/s each that are not limited by PCIe.</p>`,
        a: `<ol><li><strong>Recompute:</strong> 8 GPUs × 2,250 TFLOP/s × 50% = 9 PFLOP/s. Per token: 2 FLOP × 70 × 10<sup>9</sup> parameters / 9 PFLOP/s ≈ 15.6 µs/token.</li><li><strong>Host DRAM:</strong> 8 links × 100 GB/s = 800 GB/s. Per token: 327,680 bytes / 800 GB/s ≈ 0.41 µs/token, about 38× faster than recomputing.</li><li><strong>One NVMe drive:</strong> 327,680 bytes / 14 GB/s ≈ 23.4 µs/token, <strong>slower</strong> than recomputing.</li><li><strong>Break-even:</strong> need n × 14 GB/s > 327,680 bytes / 15.6 µs ≈ 21 GB/s, so <strong>2 drives</strong> beat recomputing (28 GB/s gives 11.7 µs/token), and 4 drives (56 GB/s, 5.9 µs/token) win clearly.</li></ol><p>Ignoring attention FLOPs favors recomputing. Attention grows with the square of context, so at long contexts the storage tiers look even better. The general lesson: the faster the GPU, the more storage bandwidth an offload tier needs to stay worth it.</p>`
      },
      {
        q: `<p>A 20-billion-parameter model trains on one H200 with ZeRO-Offload. Estimate the time per step for the GPU's forward and backward passes, the CPU's Adam update, and the PCIe transfers. Which dominates, and what does overlap buy?</p><p class="given">Assume 16,384 tokens per step, 6 FLOPs per parameter per token for forward plus backward, 989 TFLOP/s dense BF16 at 50% utilization, a CPU Adam update that reads and writes 12 bytes of FP32 state per parameter, reads 2 bytes of gradient, and writes 2 bytes of BF16 weights (28 bytes/parameter in total) at 600 GB/s of host bandwidth, and PCIe at 50 GB/s per direction carrying 2 bytes/parameter of gradients down and 2 bytes/parameter of weights back.</p>`,
        a: `<ol><li><strong>GPU:</strong> 6 FLOP × 20 × 10<sup>9</sup> parameters × 16,384 tokens ≈ 1.97 PFLOP. At 494.5 TFLOP/s, that's about 3.97 s.</li><li><strong>CPU Adam:</strong> 20 × 10<sup>9</sup> parameters × 28 bytes = 560 GB. At 600 GB/s, that's about 0.93 s.</li><li><strong>PCIe:</strong> 20 × 10<sup>9</sup> parameters × 2 bytes = 40 GB each way. At 50 GB/s, that's 0.8 s per direction, and the two directions can run at the same time.</li><li><strong>Serialized:</strong> 3.97 s + 0.8 s + 0.93 s + 0.8 s ≈ 6.5 s. The GPU dominates, but offload adds about 64%.</li><li><strong>Overlapped</strong> (send each layer's gradients during the backward pass and update parameters on the CPU as they arrive, as ZeRO-Offload does): the CPU and PCIe work hides largely under the 3.97 s GPU time, so the step approaches 4 s. The final layers' updates and weight returns remain exposed, a fraction of a second. ZeRO-Offload also uses delayed parameter updates to hide the last of it.</li></ol><p>With fewer tokens per step, the GPU time shrinks while CPU and PCIe time don't, so offloading turns host-bound. That's why it pairs with large batches.</p>`
      }
    ]
  }
}
]);
