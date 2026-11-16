/* Shared data registry. Each file in sections/ calls section(region, notes).
   Script order in index.html decides region order on the page. */
const REGIONS = [];
const NOTES = [];
/* Regions whose pages are tabbed interview pages (Q/M cards, coding tab). */
const INTV_REGIONS = ["intv", "resume"];
const isIntv = id => INTV_REGIONS.includes(id);

function section(region, notes) {
  REGIONS.push(region);
  for (const n of notes) NOTES.push(Object.assign({ region: region.id }, n));
}

/* Home-page tabs, in display order. Every region sits in exactly one tab,
   and the first tab is the default home page. */
const TABS = [
  { id: "cpu", name: "CPU Core", regions: ["isa", "pipe", "fe", "core", "sched", "mdep", "arith"] },
  { id: "memsys", name: "Memory System", regions: ["mem", "ctr", "vm", "coh", "icx"] },
  { id: "perf", name: "Performance Modeling", regions: ["perf", "stall", "proc"] },
  { id: "gpu", name: "GPUs", regions: ["gk", "gthr", "gvis", "gsm", "gwarp", "gmem", "gai", "gperf"] },
  { id: "os", name: "Operating System", regions: ["os", "task", "osmem", "io"] },
  { id: "sw", name: "Systems Software", regions: ["comp", "conc"] },
  { id: "chip", name: "Chip Design and Verification", regions: ["fab", "circ", "eda", "verif"] },
  { id: "ai", name: "AI", regions: ["gen", "llm", "aisys"] },
  { id: "intv", name: "Interview Prep", regions: ["intv", "resume", "todo", "cal"] }
];
