/* Coding problems for the interview pages: public repo and GitHub Pages
   only. The claude.ai artifact is published without coding/, so there
   these script tags load nothing and the pages show Conceptual and Math
   only. Load before sections/interview-prep.js, whose tabbed() adds a
   Coding tab to any page with problems here.

   C(page, section, { q, lvl, head, todo, impl, tests, a, threads }) files a
   problem under an interview page's topic section (tools/check.js checks
   both exist and that every interview page has at least one). The
   skeleton in the code box is head + todo + tests, and the reference
   solution is head + impl + tests: head holds the includes and types,
   todo the stubs to fill in, impl the reference code, and tests a main()
   that prints a line per failed check and a total. a explains the
   solution. threads runs it on simulated pthreads (coding/crun.js). The
   box starts as tall as the reference solution. */
(function () {
const CHECK = String.raw`static int passed, failed;
#define CHECK(cond, ...) do { if (cond) passed++; else { failed++; \
    printf("FAIL (line %d): ", __LINE__); printf(__VA_ARGS__); printf("\n"); } } while (0)
#define REPORT() (printf("%d of %d checks passed\n", passed, passed + failed), failed != 0)
`;
const CODING = window.INTV_CODING = [];
const C = (page, sec, p) => {
  const top = p.head.trim() + "\n\n" + CHECK + "\n";
  CODING.push({ page, sec, q: p.q, lvl: p.lvl, a: p.a, threads: !!p.threads, impl: p.impl.trim(),
    skel: top + p.todo.trim() + "\n\n" + p.tests.trim() + "\n",
    sol: top + p.impl.trim() + "\n\n" + p.tests.trim() + "\n" });
};

window.INTV_CODING_HELP = `<p>Each coding problem opens with a skeleton: the includes, the functions to fill in, and a <code>main()</code> that runs checks and prints any failure. The box starts as tall as the reference solution. Run compiles with Clang 21 to WebAssembly in your browser (about 15 MB to download the first time, then cached) and prints the program’s output. Your code saves in this browser as you type. Concurrency problems run on simulated threads: one core, with a thread switch possible at every atomic operation, lock call, and <code>sched_yield()</code>, chosen from a seed you can change to replay or vary the interleaving. Memory there is always sequentially consistent, so a missing acquire or release won’t show up as a failure. Check orderings by reasoning. The Coding tab is about 20% medium and 80% hard.</p>`;

C("intv-pipeline", "width", {
lvl: "hard",
q: `<p>Model the issue stage of a 2-wide in-order core. Write <code>schedule()</code>, which fills <code>issue[i]</code> with the cycle instruction <em>i</em> issues and returns the cycle the last result is ready (the largest <code>issue[i] + latency</code>). The first instruction issues in cycle 0. Each instruction issues in the earliest cycle that satisfies every rule:</p>
<ul>
<li><strong>In order:</strong> never before the instruction ahead of it.</li>
<li><strong>Width:</strong> at most <code>width</code> instructions per cycle.</li>
<li><strong>Ports:</strong> at most one LOAD or STORE per cycle, and at most one MUL per cycle. Units are pipelined.</li>
<li><strong>RAW:</strong> a source register is ready <code>latency</code> cycles after its producer issues. Latencies: ALU 1, MUL 3, LOAD 4, STORE 1.</li>
<li><strong>WAW:</strong> results are written when ready, so an instruction must become ready strictly after any older instruction that writes the same register.</li>
<li>Register 0 always reads as zero and writes to it are dropped, so it creates no dependences. STORE reads <code>rs1</code> and <code>rs2</code> and writes nothing.</li>
</ul>`,
head: String.raw`#include <stdio.h>

typedef enum { ALU, MUL, LOAD, STORE } op_t;
typedef struct { op_t op; int rd, rs1, rs2; } instr_t;

static const int LATENCY[] = { [ALU] = 1, [MUL] = 3, [LOAD] = 4, [STORE] = 1 };
#define NREGS 32`,
todo: String.raw`int schedule(const instr_t *code, int n, int width, int issue[]) {
    /* TODO */
    return 0;
}`,
impl: String.raw`int schedule(const instr_t *code, int n, int width, int issue[]) {
    int ready[NREGS] = {0};   /* cycle each register's newest value is ready */
    int cycle = 0, in_cycle = 0, mem_used = 0, mul_used = 0, last = 0;
    for (int i = 0; i < n; i++) {
        const instr_t *in = &code[i];
        int lat = LATENCY[in->op];
        int t = cycle;
        if (in->rs1) t = t > ready[in->rs1] ? t : ready[in->rs1];
        if (in->rs2) t = t > ready[in->rs2] ? t : ready[in->rs2];
        int writes = in->op != STORE && in->rd != 0;
        if (writes && t + lat <= ready[in->rd]) t = ready[in->rd] - lat + 1;
        /* Width and port limits only bind if we stay in the current cycle. */
        int is_mem = in->op == LOAD || in->op == STORE, is_mul = in->op == MUL;
        if (t == cycle && (in_cycle == width || (is_mem && mem_used) || (is_mul && mul_used))) t++;
        if (t != cycle) { cycle = t; in_cycle = mem_used = mul_used = 0; }
        issue[i] = t;
        in_cycle++;
        mem_used |= is_mem;
        mul_used |= is_mul;
        if (writes) ready[in->rd] = t + lat;
        if (t + lat > last) last = t + lat;
    }
    return last;
}`,
tests: String.raw`static void expect(const char *name, const instr_t *code, int n, int width,
                   const int *want, int want_last) {
    int issue[16];
    int last = schedule(code, n, width, issue);
    for (int i = 0; i < n; i++)
        CHECK(issue[i] == want[i], "%s: I%d issues in cycle %d, expected %d", name, i, issue[i], want[i]);
    CHECK(last == want_last, "%s: last result ready in cycle %d, expected %d", name, last, want_last);
}

int main(void) {
    instr_t indep[] = { {ALU, 1, 2, 3}, {ALU, 4, 5, 6}, {ALU, 7, 8, 9}, {ALU, 10, 11, 12} };
    expect("4 independent ALU ops", indep, 4, 2, (int[]){0, 0, 1, 1}, 2);

    instr_t load_use[] = { {LOAD, 1, 2, 0}, {ALU, 2, 1, 1}, {ALU, 3, 4, 5} };
    expect("load-use", load_use, 3, 2, (int[]){0, 4, 4}, 5);

    instr_t two_loads[] = { {LOAD, 1, 2, 0}, {LOAD, 3, 4, 0} };
    expect("one memory port", two_loads, 2, 2, (int[]){0, 1}, 5);

    instr_t waw[] = { {LOAD, 1, 2, 0}, {ALU, 1, 3, 4} };
    expect("WAW behind a load", waw, 2, 2, (int[]){0, 4}, 5);

    instr_t muls[] = { {MUL, 1, 2, 3}, {MUL, 4, 5, 6}, {ALU, 7, 1, 4} };
    expect("one multiplier", muls, 3, 2, (int[]){0, 1, 4}, 5);

    instr_t chain[] = { {ALU, 1, 2, 3}, {ALU, 2, 1, 1} };
    expect("dependent pair, 4 wide", chain, 2, 4, (int[]){0, 1}, 2);

    instr_t zero[] = { {LOAD, 0, 1, 0}, {ALU, 2, 0, 0} };
    expect("register 0", zero, 2, 2, (int[]){0, 0}, 4);

    instr_t store[] = { {ALU, 1, 2, 3}, {STORE, 0, 4, 1}, {LOAD, 5, 4, 0}, {ALU, 6, 7, 8} };
    expect("store then load", store, 4, 2, (int[]){0, 1, 2, 2}, 6);

    return REPORT();
}`,
a: `<p>One pass in program order is enough, because an in-order machine never issues an instruction before the one ahead of it. For each instruction, start at the current issue cycle and push the candidate cycle later for each rule:</p>
<ul>
<li><strong>RAW:</strong> wait for <code>ready[rs]</code>, the cycle the newest value of each source is ready.</li>
<li><strong>WAW:</strong> if <code>t + lat</code> would not be after <code>ready[rd]</code>, move to <code>ready[rd] − lat + 1</code>. Without this, the short ALU op in the WAW check would write <code>r1</code> before the older load and then be overwritten by stale data.</li>
<li><strong>Width and ports:</strong> they only bind if the instruction stays in the same cycle as instructions already issued there. If the dependence rules already moved it to a later cycle, that cycle is empty.</li>
</ul>
<p>The common bug is to check width and ports first and dependences second. That can leave an instruction in a cycle where the port is free but a later cycle was required. Also note that STORE writes nothing, so its <code>rd</code> field must not create a WAW dependence. In the last check, the store issues in cycle 1 behind the ALU result, and the load has to wait for cycle 2 because the store holds the only memory port in cycle 1.</p>`
});

C("intv-pipeline", "stalls", {
lvl: "hard",
q: `<p>Model the classic 5-stage pipeline (IF, ID, EX, MEM, WB). Write <code>simulate()</code>, which fills <code>wb[i]</code> with the cycle instruction <em>i</em> is in WB and returns the total cycle count. Instruction 0 is in IF in cycle 0. The trace is dynamic: the instruction after a taken branch is its target.</p>
<ul>
<li>One instruction per stage. An instruction stalled in ID holds the next one in IF.</li>
<li>ALU, LOAD, STORE, and BRANCH spend 1 cycle in EX. MUL spends 3 cycles in EX and isn’t pipelined, so nothing else can enter EX until it leaves.</li>
<li>Full forwarding: an ALU or MUL result can be used by an instruction entering EX the cycle after the producer leaves EX. A LOAD result can be used in EX the cycle after the load leaves MEM.</li>
<li>ALU, MUL, and BRANCH read <code>rs1</code> and <code>rs2</code> when they enter EX. LOAD reads <code>rs1</code>. STORE reads <code>rs1</code> in EX and its data <code>rs2</code> in MEM, so its data never causes a stall.</li>
<li>Branches are predicted not taken and resolve at the end of EX. After a taken branch, the next instruction enters IF the cycle after the branch leaves EX.</li>
<li>Register 0 is always zero and creates no dependences.</li>
</ul>`,
head: String.raw`#include <stdio.h>

typedef enum { ALU, MUL, LOAD, STORE, BRANCH } op_t;
typedef struct { op_t op; int rd, rs1, rs2, taken; } instr_t;
#define NREGS 32`,
todo: String.raw`int simulate(const instr_t *code, int n, int wb[]) {
    /* TODO */
    return 0;
}`,
impl: String.raw`static int max(int a, int b) { return a > b ? a : b; }

int simulate(const instr_t *code, int n, int wb[]) {
    int avail[NREGS] = {0};   /* first cycle a consumer may enter EX */
    int prev_if = -1, prev_id = 0, prev_ex = 0, prev_ex_end = -1, redirect = -1;
    for (int i = 0; i < n; i++) {
        const instr_t *in = &code[i];
        /* IF: one cycle after the previous fetch, but the previous
           instruction must have moved on to ID. */
        int f = i == 0 ? 0 : max(prev_if + 1, prev_id);
        if (redirect >= 0) { f = redirect; redirect = -1; }
        int d = i == 0 ? 1 : max(f + 1, prev_ex);          /* ID */
        int e = max(d + 1, prev_ex_end + 1);                 /* EX: unit free */
        int reads2 = in->op == ALU || in->op == MUL || in->op == BRANCH;
        if (in->rs1) e = max(e, avail[in->rs1]);
        if (reads2 && in->rs2) e = max(e, avail[in->rs2]);
        int ex_end = e + (in->op == MUL ? 2 : 0);
        wb[i] = ex_end + 2;
        if ((in->op == ALU || in->op == MUL) && in->rd) avail[in->rd] = ex_end + 1;
        if (in->op == LOAD && in->rd) avail[in->rd] = ex_end + 2;
        if (in->op == BRANCH && in->taken) redirect = ex_end + 1;
        prev_if = f; prev_id = d; prev_ex = e; prev_ex_end = ex_end;
    }
    return n ? wb[n - 1] + 1 : 0;
}`,
tests: String.raw`static void expect(const char *name, const instr_t *code, int n, const int *want, int want_total) {
    int wb[16];
    int total = simulate(code, n, wb);
    for (int i = 0; i < n; i++)
        CHECK(wb[i] == want[i], "%s: I%d in WB in cycle %d, expected %d", name, i, wb[i], want[i]);
    CHECK(total == want_total, "%s: %d cycles, expected %d", name, total, want_total);
}

int main(void) {
    instr_t indep[] = { {ALU, 1, 2, 3}, {ALU, 4, 5, 6}, {ALU, 7, 8, 9}, {ALU, 10, 11, 12}, {ALU, 13, 14, 15} };
    expect("no hazards", indep, 5, (int[]){4, 5, 6, 7, 8}, 9);

    instr_t load_use[] = { {LOAD, 1, 2}, {ALU, 3, 1, 4} };
    expect("load-use", load_use, 2, (int[]){4, 6}, 7);

    instr_t gap[] = { {LOAD, 1, 2}, {ALU, 5, 6, 7}, {ALU, 3, 1, 4} };
    expect("load, gap, use", gap, 3, (int[]){4, 5, 6}, 7);

    instr_t mul[] = { {MUL, 1, 2, 3}, {ALU, 4, 1, 1}, {ALU, 5, 6, 7} };
    expect("MUL holds EX", mul, 3, (int[]){6, 7, 8}, 9);

    instr_t br[] = { {ALU, 1, 2, 3}, {BRANCH, 0, 1, 0, 1}, {ALU, 4, 5, 6} };
    expect("taken branch", br, 3, (int[]){4, 5, 8}, 9);

    instr_t ld_br[] = { {LOAD, 1, 2}, {BRANCH, 0, 1, 0, 1}, {ALU, 4, 5, 6} };
    expect("load feeds a taken branch", ld_br, 3, (int[]){4, 6, 9}, 10);

    instr_t nt[] = { {BRANCH, 0, 1, 2, 0}, {ALU, 4, 5, 6} };
    expect("not-taken branch", nt, 2, (int[]){4, 5}, 6);

    instr_t zero[] = { {LOAD, 0, 2}, {ALU, 3, 0, 0} };
    expect("register 0", zero, 2, (int[]){4, 5}, 6);

    instr_t st[] = { {LOAD, 1, 2}, {STORE, 0, 3, 1}, {LOAD, 4, 5}, {STORE, 0, 4, 6} };
    expect("store data vs. store address", st, 4, (int[]){4, 5, 6, 8}, 9);

    return REPORT();
}`,
a: `<p>Track, for each instruction, the cycle it enters IF, ID, and EX, and the cycle it leaves EX. Every rule becomes a <code>max()</code>:</p>
<ul>
<li><strong>IF:</strong> one cycle after the previous fetch, but not before the previous instruction has moved into ID (a stall in ID backs up IF). A taken branch overrides this with the cycle after it leaves EX, which is a 2-cycle penalty when the branch didn’t stall.</li>
<li><strong>ID:</strong> one cycle after IF, but not before the previous instruction has moved into EX.</li>
<li><strong>EX:</strong> one cycle after ID, after the previous instruction leaves EX (this is what a 3-cycle unpipelined MUL blocks), and after every source is forwardable.</li>
<li>MEM and WB follow EX directly, because EX is in order and every instruction spends one cycle in each.</li>
</ul>
<p>The forwarding rules set when a value is usable in EX: an ALU or MUL result one cycle after the producer leaves EX, and a LOAD result two cycles after (one after MEM). That gives the single load-use bubble, and none when one instruction separates the load from its use. A load feeding a branch costs the bubble plus the 2-cycle redirect.</p>
<p>Traps the checks cover: STORE data is read in MEM, so a load followed by a store of the loaded value doesn’t stall, but a load followed by a store that uses it as the address does. Register 0 never creates a dependence. A MUL delays independent instructions too, because EX is busy.</p>`
});

C("intv-renaming", "deps", {
lvl: "medium",
q: `<p>How much does renaming buy on a trace? Write <code>makespan()</code>: give every instruction the earliest start time that its dependences allow, with unlimited execution units, and return the cycle the last result is ready (the largest <code>start + lat</code>). Sources are read at start, and a result is written <code>lat</code> cycles later. Register −1 means none.</p>
<ul>
<li>With <code>renamed</code> set, only true dependences (RAW) constrain: a source is ready when its most recent older producer’s result is.</li>
<li>Without renaming, also honor the false dependences. <strong>WAR:</strong> an instruction’s write must land strictly after every older read of the value it overwrites. <strong>WAW:</strong> its write must land strictly after the previous write of the same register.</li>
</ul>`,
head: String.raw`#include <stdio.h>

typedef struct { int rd, rs1, rs2, lat; } instr_t;
#define NREGS 16`,
todo: String.raw`int makespan(const instr_t *code, int n, int renamed) {
    /* TODO */
    return 0;
}`,
impl: String.raw`static int max(int a, int b) { return a > b ? a : b; }

int makespan(const instr_t *code, int n, int renamed) {
    int ready[NREGS] = {0};       /* when the newest value is ready */
    int last_read[NREGS];         /* latest read of the newest value */
    for (int r = 0; r < NREGS; r++) last_read[r] = -1;
    int end = 0;
    for (int i = 0; i < n; i++) {
        const instr_t *in = &code[i];
        int t = 0;
        if (in->rs1 >= 0) t = max(t, ready[in->rs1]);
        if (in->rs2 >= 0) t = max(t, ready[in->rs2]);
        if (!renamed && in->rd >= 0) {
            t = max(t, last_read[in->rd] - in->lat + 1);   /* WAR */
            t = max(t, ready[in->rd] - in->lat + 1);       /* WAW */
        }
        if (in->rs1 >= 0) last_read[in->rs1] = max(last_read[in->rs1], t);
        if (in->rs2 >= 0) last_read[in->rs2] = max(last_read[in->rs2], t);
        if (in->rd >= 0) { ready[in->rd] = t + in->lat; last_read[in->rd] = -1; }
        end = max(end, t + in->lat);
    }
    return end;
}`,
tests: String.raw`static void expect(const char *name, const instr_t *code, int n, int want_renamed, int want_plain) {
    int a = makespan(code, n, 1), b = makespan(code, n, 0);
    CHECK(a == want_renamed, "%s, renamed: %d cycles, expected %d", name, a, want_renamed);
    CHECK(b == want_plain, "%s, not renamed: %d cycles, expected %d", name, b, want_plain);
}

int main(void) {
    /* r1 = load (4) / r2 = r1 + r3 / r3 = r4 + r5 / r6 = r3 + r3 */
    instr_t war[] = { {1, 7, -1, 4}, {2, 1, 3, 1}, {3, 4, 5, 1}, {6, 3, 3, 1} };
    expect("WAR on r3", war, 4, 5, 6);

    /* r1 = load (4) / r1 = r2 + r3 */
    instr_t waw[] = { {1, 7, -1, 4}, {1, 2, 3, 1} };
    expect("WAW on r1", waw, 2, 4, 5);

    /* r1 = r1 + r1, three times: a true chain either way */
    instr_t chain[] = { {1, 1, 1, 1}, {1, 1, 1, 1}, {1, 1, 1, 1} };
    expect("self chain", chain, 3, 3, 3);

    /* r1 = mul (3) / r4 = r1 + r5 / r1 = r6 + r7 / r8 = r1 + r4 */
    instr_t mixed[] = { {1, 2, 3, 3}, {4, 1, 5, 1}, {1, 6, 7, 1}, {8, 1, 4, 1} };
    expect("reuse of r1", mixed, 4, 5, 5);

    /* r1 reused as a temporary three times:
       r1 = load (5) / r2 = r1 + r1 / r1 = r3 + r4 / r5 = r1 + r1 / r1 = r6 + r6 / r8 = r1 + r1 */
    instr_t temp[] = { {1, 7, -1, 5}, {2, 1, 1, 1}, {1, 3, 4, 1}, {5, 1, 1, 1}, {1, 6, 6, 1}, {8, 1, 1, 1} };
    expect("r1 as a reused temporary", temp, 6, 6, 8);

    return REPORT();
}`,
a: `<p>Keep two times per architectural register: when its newest value is ready, and the latest time that value is read. Each rule then becomes a lower bound on the start time:</p>
<ul>
<li><strong>RAW:</strong> <code>t ≥ ready[src]</code></li>
<li><strong>WAR:</strong> the write at <code>t + lat</code> must come after the last read, so <code>t ≥ last_read[rd] − lat + 1</code></li>
<li><strong>WAW:</strong> <code>t ≥ ready[rd] − lat + 1</code></li>
</ul>
<p>After placing the instruction, record its reads first and then reset <code>last_read[rd]</code>, because the instruction’s own read of <code>rd</code> was of the old value. In the last check, renaming lets the second and third uses of <code>r1</code> run in cycles 0 to 2, beside the load. Without renaming, the second write of <code>r1</code> must wait until the add has read the loaded value in cycle 5 (WAR) and the load has written it (WAW), and the third write waits for the second one’s reader, so the trace takes 8 cycles instead of 6.</p>
<p>A trap: when the overwriting instruction is slow, WAR often costs nothing, because its write lands late anyway. False dependences hurt most when a short-latency op reuses a register still being read by work waiting on a long-latency producer.</p>
<p>This is the dataflow limit of the trace: a real core can only get closer to it with a big enough window and enough units, which makes it a useful upper bound to compute in a model before arguing about structure sizes.</p>`
});

C("intv-renaming", "recover", {
lvl: "hard",
q: `<p>Build the rename stage for x86-64’s 16 integer registers with Golden Cove’s 280 integer physical registers. At reset, architectural register <em>i</em> maps to physical <em>i</em>, and physical registers 16 to 279 are free, handed out in that order.</p>
<ul>
<li><code>rn_rename()</code> renames one instruction. Register −1 means none. It returns 0 and changes nothing if a destination needs a register and none is free. Otherwise it fills the physical sources, the new destination, and the destination’s previous mapping (−1 if none).</li>
<li><code>rn_retire()</code> runs when an instruction retires and frees its previous mapping. Freed registers are reused after the ones already free.</li>
<li><code>rn_checkpoint()</code> saves state at a branch, into one of 8 slots. <code>rn_restore()</code> rolls back to a checkpoint after a mispredict: the mappings return to what they were, and every register allocated after the checkpoint is free again, while registers freed by retirement since then stay free. Make restore cost O(registers), not O(instructions squashed).</li>
</ul>`,
head: String.raw`#include <stdio.h>
#include <string.h>

#define ARCH 16
#define PHYS 280
#define CKPTS 8`,
todo: String.raw`typedef struct {
    int rat[ARCH];   /* architectural to physical */
    /* TODO: add a free list and checkpoints */
} rename_t;

void rn_init(rename_t *r) {
    /* TODO */
}

int rn_rename(rename_t *r, int rd, int rs1, int rs2,
              int *pdst, int *ps1, int *ps2, int *pold) {
    /* TODO */
    return 0;
}

void rn_retire(rename_t *r, int pold) {
    /* TODO */
}

void rn_checkpoint(rename_t *r, int slot) {
    /* TODO */
}

void rn_restore(rename_t *r, int slot) {
    /* TODO */
}

int rn_free_count(const rename_t *r) {
    /* TODO */
    return 0;
}`,
impl: String.raw`/* The free list is a circular FIFO with free-running head and tail
   counters. Allocation advances head and a free appends at tail, so a
   checkpoint only needs the RAT and head: restoring head hands back every
   register allocated since, in the same order, while frees appended at
   the tail in the meantime stay. It never overflows, because at most
   PHYS - ARCH registers are free at once. */
typedef struct { int rat[ARCH]; unsigned head; } ckpt_t;
typedef struct {
    int rat[ARCH];
    int fl[PHYS];
    unsigned fl_head, fl_tail;
    ckpt_t ck[CKPTS];
} rename_t;

void rn_init(rename_t *r) {
    for (int i = 0; i < ARCH; i++) r->rat[i] = i;
    r->fl_head = r->fl_tail = 0;
    for (int p = ARCH; p < PHYS; p++) r->fl[r->fl_tail++ % PHYS] = p;
}

int rn_rename(rename_t *r, int rd, int rs1, int rs2,
              int *pdst, int *ps1, int *ps2, int *pold) {
    if (rd >= 0 && r->fl_tail == r->fl_head) return 0;
    *ps1 = rs1 >= 0 ? r->rat[rs1] : -1;   /* read sources before the write */
    *ps2 = rs2 >= 0 ? r->rat[rs2] : -1;
    if (rd >= 0) {
        *pold = r->rat[rd];
        *pdst = r->fl[r->fl_head++ % PHYS];
        r->rat[rd] = *pdst;
    } else {
        *pold = *pdst = -1;
    }
    return 1;
}

void rn_retire(rename_t *r, int pold) {
    if (pold >= 0) r->fl[r->fl_tail++ % PHYS] = pold;
}

void rn_checkpoint(rename_t *r, int slot) {
    memcpy(r->ck[slot].rat, r->rat, sizeof r->rat);
    r->ck[slot].head = r->fl_head;
}

void rn_restore(rename_t *r, int slot) {
    memcpy(r->rat, r->ck[slot].rat, sizeof r->rat);
    r->fl_head = r->ck[slot].head;
}

int rn_free_count(const rename_t *r) {
    return (int)(r->fl_tail - r->fl_head);
}`,
tests: String.raw`int main(void) {
    rename_t r;
    int d, s1, s2, old;
    rn_init(&r);
    CHECK(rn_free_count(&r) == 264, "free count at reset %d, expected 264", rn_free_count(&r));

    /* I0: r1 = r2 + r3 */
    rn_rename(&r, 1, 2, 3, &d, &s1, &s2, &old);
    CHECK(d == 16 && s1 == 2 && s2 == 3 && old == 1, "I0 got d=%d s=%d,%d old=%d", d, s1, s2, old);
    /* I1: r1 = r1 + r1 reads the new r1 and replaces it */
    rn_rename(&r, 1, 1, 1, &d, &s1, &s2, &old);
    CHECK(d == 17 && s1 == 16 && s2 == 16 && old == 16, "I1 got d=%d s=%d,%d old=%d", d, s1, s2, old);
    /* I2: compare r1, r4 writes no register */
    rn_rename(&r, -1, 1, 4, &d, &s1, &s2, &old);
    CHECK(d == -1 && old == -1 && s1 == 17 && s2 == 4, "I2 got d=%d s=%d,%d old=%d", d, s1, s2, old);
    CHECK(rn_free_count(&r) == 262, "free count %d, expected 262", rn_free_count(&r));

    /* Checkpoint at a branch, run down the wrong path, retire I0 meanwhile. */
    rn_checkpoint(&r, 3);
    rn_rename(&r, 5, 1, -1, &d, &s1, &s2, &old);   /* gets 18 */
    rn_rename(&r, 1, 5, -1, &d, &s1, &s2, &old);   /* gets 19 */
    rn_rename(&r, 6, -1, -1, &d, &s1, &s2, &old);  /* gets 20 */
    CHECK(d == 20, "third wrong-path register %d, expected 20", d);
    rn_retire(&r, 1);    /* I0 retires: frees its old mapping, p1 */
    rn_restore(&r, 3);
    CHECK(r.rat[1] == 17 && r.rat[5] == 5 && r.rat[6] == 6, "restore left r1=%d r5=%d r6=%d", r.rat[1], r.rat[5], r.rat[6]);
    CHECK(rn_free_count(&r) == 263, "free count after restore %d, expected 263", rn_free_count(&r));
    rn_rename(&r, 7, -1, -1, &d, &s1, &s2, &old);
    CHECK(d == 18, "first register after restore %d, expected 18", d);

    /* Exhaust the free list: 262 more renames succeed, then one stalls. */
    int ok = 0;
    for (int i = 0; i < 300; i++) ok += rn_rename(&r, i % ARCH, -1, -1, &d, &s1, &s2, &old);
    CHECK(ok == 262, "%d renames succeeded with 262 free, expected 262", ok);
    CHECK(d == 1, "the last register handed out was p%d, expected p1", d);
    int before = r.rat[2];
    CHECK(rn_rename(&r, 2, 3, -1, &d, &s1, &s2, &old) == 0 && r.rat[2] == before, "a rename with no free register must stall and change nothing");
    rn_retire(&r, 200);
    CHECK(rn_rename(&r, 2, 3, -1, &d, &s1, &s2, &old) == 1 && d == 200, "after a retire the freed register should be used, got %d", d);

    return REPORT();
}`,
a: `<p>Reading the sources before writing the destination is what makes <code>r1 = r1 + r1</code> read the old mapping. The previous mapping goes into the ROB with the instruction, and it is freed when the instruction retires, because only then can no older instruction still need that value.</p>
<p>The key choice is the free list. A circular FIFO with free-running <code>head</code> and <code>tail</code> counters lets a checkpoint be just the RAT plus <code>head</code>. Restoring <code>head</code> returns every register allocated on the wrong path in one step, and registers that retirement appended at the tail in the meantime stay free. A stack-based free list breaks here: after a restore you can’t tell which entries on the stack were pushed by retirement and which were popped by the wrong path. The alternatives are walking the squashed ROB entries backwards (O(instructions), which is what cores without checkpoints do) or keeping a free bit-vector per checkpoint.</p>
<p>Real cores store as many checkpoints as they can afford (each is 16 × 9 bits of RAT plus the head) and fall back to the ROB walk when a branch has none. A restore makes the free list exact again in one cycle, which is what keeps mispredict recovery short.</p>`
});

C("intv-rob", "retire", {
lvl: "hard",
q: `<p>Write the reorder buffer’s bookkeeping as a circular buffer. The size is 8 here so the checks wrap often. Golden Cove’s ROB has 512 entries.</p>
<ul>
<li><code>rob_alloc()</code> adds the youngest instruction and returns its slot, or −1 when the ROB is full.</li>
<li><code>rob_complete()</code> marks a slot finished.</li>
<li><code>rob_retire()</code> removes up to <code>width</code> finished instructions from the head, in order, and stops at the first one not finished. It writes their PCs to <code>out</code> and returns how many retired.</li>
<li><code>rob_flush_after()</code> runs on a mispredict: it removes every instruction younger than <code>slot</code> and returns how many it removed. The next allocation goes to the slot after <code>slot</code>.</li>
</ul>`,
head: String.raw`#include <stdio.h>

#define ROB_SIZE 8

typedef struct { int pc, done; } rob_entry_t;
typedef struct {
    rob_entry_t e[ROB_SIZE];
    int head, tail, count;
} rob_t;`,
todo: String.raw`void rob_init(rob_t *r) {
    /* TODO */
}

int rob_alloc(rob_t *r, int pc) {
    /* TODO */
    return -1;
}

void rob_complete(rob_t *r, int slot) {
    /* TODO */
}

int rob_retire(rob_t *r, int width, int out[]) {
    /* TODO */
    return 0;
}

int rob_flush_after(rob_t *r, int slot) {
    /* TODO */
    return 0;
}`,
impl: String.raw`void rob_init(rob_t *r) { r->head = r->tail = r->count = 0; }

int rob_alloc(rob_t *r, int pc) {
    if (r->count == ROB_SIZE) return -1;
    int s = r->tail;
    r->e[s] = (rob_entry_t){ pc, 0 };
    r->tail = (r->tail + 1) % ROB_SIZE;
    r->count++;
    return s;
}

void rob_complete(rob_t *r, int slot) { r->e[slot].done = 1; }

int rob_retire(rob_t *r, int width, int out[]) {
    int n = 0;
    while (n < width && r->count > 0 && r->e[r->head].done) {
        out[n++] = r->e[r->head].pc;
        r->head = (r->head + 1) % ROB_SIZE;
        r->count--;
    }
    return n;
}

int rob_flush_after(rob_t *r, int slot) {
    /* Age of slot = its distance from the head. Everything past it goes. */
    int age = (slot - r->head + ROB_SIZE) % ROB_SIZE;
    int removed = r->count - (age + 1);
    r->count = age + 1;
    r->tail = (slot + 1) % ROB_SIZE;
    return removed;
}`,
tests: String.raw`int main(void) {
    rob_t r;
    int out[8], s[16];
    rob_init(&r);
    for (int i = 0; i < 8; i++) s[i] = rob_alloc(&r, 100 + i);
    CHECK(s[0] == 0 && s[7] == 7, "slots %d..%d, expected 0..7", s[0], s[7]);
    CHECK(rob_alloc(&r, 999) == -1, "a full ROB must refuse an allocation");

    /* Finish out of order: 1, 2, 0, 5. Retire 4-wide: 0, 1, 2 go, 3 blocks. */
    rob_complete(&r, 1); rob_complete(&r, 2);
    CHECK(rob_retire(&r, 4, out) == 0, "nothing may retire while the head is unfinished");
    rob_complete(&r, 0); rob_complete(&r, 5);
    int n = rob_retire(&r, 4, out);
    CHECK(n == 3 && out[0] == 100 && out[2] == 102, "retired %d (first pc %d), expected 3 starting at 100", n, out[0]);

    /* Wrap around: three new entries go to slots 0, 1, 2. */
    for (int i = 8; i < 11; i++) s[i] = rob_alloc(&r, 100 + i);
    CHECK(s[8] == 0 && s[10] == 2, "wrapped slots %d..%d, expected 0..2", s[8], s[10]);
    CHECK(rob_alloc(&r, 999) == -1, "full again after wrapping");

    /* Mispredict at slot 6 (pc 106): removes 107, 108, 109, 110. */
    CHECK(rob_flush_after(&r, 6) == 4, "flush after slot 6 should remove 4");
    CHECK(rob_alloc(&r, 200) == 7, "next allocation should reuse slot 7");
    CHECK(rob_flush_after(&r, 7) == 0, "flushing after the youngest removes nothing");

    /* Width limit, then drain in order across the wrap. */
    rob_complete(&r, 3); rob_complete(&r, 4); rob_complete(&r, 6); rob_complete(&r, 7);
    n = rob_retire(&r, 2, out);
    CHECK(n == 2 && out[0] == 103 && out[1] == 104, "width 2 should retire 103 and 104, got %d", n);
    n = rob_retire(&r, 8, out);
    CHECK(n == 3 && out[0] == 105 && out[1] == 106 && out[2] == 200, "drain retired %d, expected 105, 106, 200", n);
    CHECK(r.count == 0, "ROB should be empty, count %d", r.count);

    /* Mispredict at the head itself keeps exactly one entry. */
    int h = rob_alloc(&r, 300);
    rob_alloc(&r, 301); rob_alloc(&r, 302);
    CHECK(rob_flush_after(&r, h) == 2 && r.count == 1, "flush after the head should leave 1 entry");

    return REPORT();
}`,
a: `<p>A separate <code>count</code> resolves the classic ambiguity of a circular buffer: with only <code>head</code> and <code>tail</code>, head equal to tail can mean empty or full. Hardware usually adds a wrap bit to each pointer instead, which also gives a cheap age comparison between two ROB IDs.</p>
<p>Retirement stops at the first unfinished entry even if younger ones are done, which is the whole point of the ROB: state becomes architectural in program order, so an exception or mispredict at any instruction leaves a precise state.</p>
<p>A flush is O(1): the age of the mispredicted slot is its distance from the head modulo the size, everything past it is discarded by moving <code>tail</code> to the next slot, and the count follows. Real cores do the same with the branch’s ROB ID, and separately recover the rename map (from a checkpoint or by walking the squashed entries).</p>`
});

C("intv-rob", "sizing", {
lvl: "hard",
q: `<p>Write a window model that shows how ROB size and miss handling bound memory-level parallelism. Instructions are independent. <code>lat[i]</code> is the cycles from dispatch until instruction <em>i</em> finishes, and any latency of at least <code>MISS_LAT</code> is a cache miss. Each cycle <em>c</em>, starting at 0:</p>
<ol>
<li><strong>Retire:</strong> up to <code>width</code> instructions leave the head in order, each only if it finished by cycle <em>c</em> (dispatch cycle + latency ≤ <em>c</em>).</li>
<li><strong>Dispatch:</strong> up to <code>width</code> instructions enter the ROB in order while it has space. A miss also needs a free MSHR. It holds one from dispatch until it finishes, and a miss that can’t get one stalls dispatch.</li>
</ol>
<p>Return the number of cycles until the last instruction retires (its retire cycle + 1). Skip idle cycles so a trace of a million instructions with 300-cycle misses runs quickly.</p>`,
head: String.raw`#include <stdio.h>
#include <stdlib.h>

#define MISS_LAT 20`,
todo: String.raw`long run_window(const int *lat, int n, int rob_size, int width, int mshrs) {
    /* TODO */
    return 0;
}`,
impl: String.raw`long run_window(const int *lat, int n, int rob_size, int width, int mshrs) {
    long *done = malloc(sizeof(long) * n);   /* finish cycle per instruction */
    long *miss_end = malloc(sizeof(long) * (mshrs > 0 ? mshrs : 1));
    int nmiss = 0;                           /* misses holding MSHRs */
    int head = 0, next = 0;                  /* oldest in ROB, next to dispatch */
    long c = 0, last = 0;
    while (head < n) {
        int r = 0;
        while (r < width && head < next && done[head] <= c) { head++; r++; last = c; }
        for (int k = 0; k < nmiss; )          /* release MSHRs of finished misses */
            if (miss_end[k] <= c) miss_end[k] = miss_end[--nmiss]; else k++;
        int d = 0;
        while (d < width && next < n && next - head < rob_size) {
            if (lat[next] >= MISS_LAT) {
                if (nmiss == mshrs) break;
                miss_end[nmiss++] = c + lat[next];
            }
            done[next] = c + lat[next];
            next++; d++;
        }
        /* Skip ahead if nothing can happen until something finishes. */
        long wake = c + 1;
        if (r == 0 && d == 0 && head < next) {
            wake = done[head];
            for (int k = 0; k < nmiss; k++) if (miss_end[k] < wake) wake = miss_end[k];
            if (wake <= c) wake = c + 1;
        }
        c = wake;
    }
    free(done); free(miss_end);
    return last + 1;
}`,
tests: String.raw`static int *trace(int n, int every, int miss) {
    int *t = malloc(sizeof(int) * n);
    for (int i = 0; i < n; i++) t[i] = (every && i % every == 0) ? miss : 1;
    return t;
}

int main(void) {
    int *t = trace(8, 0, 0);
    long c = run_window(t, 8, 64, 4, 10);
    CHECK(c == 3, "8 one-cycle ops, 4 wide: %ld cycles, expected 3", c);
    free(t);

    t = trace(12, 12, 100);   /* one miss at instruction 0 */
    c = run_window(t, 12, 8, 4, 10);
    CHECK(c == 103, "one miss, ROB 8: %ld cycles, expected 103", c);
    free(t);

    t = trace(16, 8, 100);    /* misses at 0 and 8 */
    c = run_window(t, 16, 8, 4, 10);
    CHECK(c == 202, "two misses, ROB 8 (can't overlap): %ld, expected 202", c);
    c = run_window(t, 16, 16, 4, 10);
    CHECK(c == 104, "two misses, ROB 16 (overlap): %ld, expected 104", c);
    c = run_window(t, 16, 16, 4, 1);
    CHECK(c == 202, "two misses, ROB 16 but 1 MSHR: %ld, expected 202", c);
    free(t);

    /* A million instructions, a 300-cycle miss every 100: ROB 224 holds
       3 misses (Skylake), 512 holds 6 (Golden Cove). 16 MSHRs. */
    int n = 1000000;
    t = trace(n, 100, 300);
    long c224 = run_window(t, n, 224, 4, 16), c512 = run_window(t, n, 512, 6, 16);
    long c512n = run_window(t, n, 512, 4, 16), c1200 = run_window(t, n, 1200, 4, 16);
    CHECK(c224 == 1063552, "ROB 224, 4 wide: %ld cycles, expected 1063552", c224);
    CHECK(c512 == 523492, "ROB 512, 6 wide: %ld cycles, expected 523492", c512);
    CHECK(c512n == 536852, "ROB 512, 4 wide: %ld cycles, expected 536852", c512n);
    CHECK(c1200 == 250300, "ROB 1200, 4 wide: %ld cycles, expected 250300", c1200);
    free(t);

    return REPORT();
}`,
a: `<p>The loop follows the rules literally, retiring before dispatching in each cycle. Two details matter:</p>
<ul>
<li><strong>MSHRs:</strong> a miss holds one from dispatch until it finishes, which is independent of retirement, so release them by finish time each cycle before dispatching.</li>
<li><strong>Skipping:</strong> when a cycle neither retires nor dispatches, nothing changes until the head finishes or an MSHR frees, so jump to the earlier of the two. Without this, the million-instruction check walks every idle cycle of every miss.</li>
</ul>
<p>The small checks show the mechanism. With an 8-entry ROB, the second miss can’t enter while the first one blocks the head, so the two 100-cycle misses run back to back (202 cycles). With 16 entries, both are in flight together (104). One MSHR serializes them again even with the bigger ROB.</p>
<p>The big checks are the interview point. With a 300-cycle miss every 100 instructions, the ROB fills behind each miss and dispatch stops until it finishes:</p>
<ul>
<li>224 entries, 4 wide: 1,063,552 cycles, about 0.94 IPC</li>
<li>512 entries, 6 wide: 523,492 cycles, about 1.9 IPC</li>
<li>512 entries, 4 wide: 536,852 cycles, so almost all of the gain came from the ROB, not the width</li>
<li>1,200 entries, 4 wide: 250,300 cycles, full width</li>
</ul>
<p>Little’s law gives the last line: to sustain 4 instructions per cycle while each waits up to 300 cycles, about 4 × 300 = 1,200 must be in flight. Below that, throughput scales roughly with ROB size divided by miss latency, which is why memory-bound code gains from a bigger window long after extra width stops helping.</p>`
});

C("intv-sched", "ready", {
lvl: "hard",
q: `<p>Select the oldest ready entries from a 64-entry scheduler with an age matrix, the structure many out-of-order cores use to pick oldest-first without keeping entries in age order. Bit <em>j</em> of <code>older[i]</code> is 1 when entry <em>j</em> is older than entry <em>i</em>. Entries go into any free slot, so slot number says nothing about age.</p>
<ul>
<li><code>am_insert()</code> adds a new youngest entry in a free slot. <code>am_remove()</code> frees a slot.</li>
<li><code>am_select()</code> returns the oldest entry whose bit is set in <code>ready</code>, or −1. It must not loop over all 64 entries comparing ages one by one.</li>
<li><code>am_select_n()</code> returns up to <code>n</code> oldest ready entries, oldest first, for <code>n</code> issue ports.</li>
</ul>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

#define IQ 64

typedef struct {
    uint64_t valid;
    uint64_t older[IQ];
} agem_t;`,
todo: String.raw`void am_init(agem_t *m) {
    /* TODO */
}

void am_insert(agem_t *m, int slot) {
    /* TODO */
}

void am_remove(agem_t *m, int slot) {
    /* TODO */
}

int am_select(const agem_t *m, uint64_t ready) {
    /* TODO */
    return -1;
}

int am_select_n(const agem_t *m, uint64_t ready, int n, int out[]) {
    /* TODO */
    return 0;
}`,
impl: String.raw`void am_init(agem_t *m) {
    m->valid = 0;
    for (int i = 0; i < IQ; i++) m->older[i] = 0;
}

void am_insert(agem_t *m, int slot) {
    m->older[slot] = m->valid;     /* every valid entry is older than the new one */
    m->valid |= 1ull << slot;
}

void am_remove(agem_t *m, int slot) {
    uint64_t bit = 1ull << slot;
    m->valid &= ~bit;
    for (uint64_t v = m->valid; v; v &= v - 1)   /* clear the column */
        m->older[__builtin_ctzll(v)] &= ~bit;
}

int am_select(const agem_t *m, uint64_t ready) {
    ready &= m->valid;
    /* The oldest ready entry is the one with no older ready entry. In
       hardware every row checks this in parallel. */
    for (uint64_t r = ready; r; r &= r - 1) {
        int i = __builtin_ctzll(r);
        if ((m->older[i] & ready) == 0) return i;
    }
    return -1;
}

int am_select_n(const agem_t *m, uint64_t ready, int n, int out[]) {
    int k = 0;
    while (k < n) {
        int i = am_select(m, ready);
        if (i < 0) break;
        out[k++] = i;
        ready &= ~(1ull << i);
    }
    return k;
}`,
tests: String.raw`int main(void) {
    agem_t m;
    am_init(&m);
    /* Insert in age order into scattered slots: 40, 3, 63, 17, 0. */
    int order[5] = {40, 3, 63, 17, 0};
    for (int i = 0; i < 5; i++) am_insert(&m, order[i]);

    CHECK(am_select(&m, ~0ull) == 40, "oldest of all is %d, expected 40", am_select(&m, ~0ull));
    uint64_t r = (1ull << 63) | (1ull << 17) | (1ull << 0);
    CHECK(am_select(&m, r) == 63, "oldest of {63,17,0} is %d, expected 63", am_select(&m, r));
    CHECK(am_select(&m, 1ull << 5) == -1, "slot 5 is empty, so selecting it must give -1");
    CHECK(am_select(&m, 0) == -1, "nothing ready must give -1");

    int out[4];
    int n = am_select_n(&m, ~0ull, 3, out);
    CHECK(n == 3 && out[0] == 40 && out[1] == 3 && out[2] == 63, "3 oldest: %d %d %d", out[0], out[1], out[2]);

    /* Remove the oldest and reuse its slot: slot 40 is now the youngest. */
    am_remove(&m, 40);
    am_insert(&m, 40);
    n = am_select_n(&m, ~0ull, 4, out);
    CHECK(n == 4 && out[0] == 3 && out[1] == 63 && out[2] == 17 && out[3] == 0, "after reuse: %d %d %d %d", out[0], out[1], out[2], out[3]);
    n = am_select_n(&m, (1ull << 40) | (1ull << 0), 4, out);
    CHECK(n == 2 && out[0] == 0 && out[1] == 40, "0 is older than reused 40: got %d %d", out[0], out[1]);

    /* Against a reference: random inserts and removes with sequence numbers. */
    am_init(&m);
    long seq[IQ], now = 0;
    int bad = 0;
    srand(1);
    for (int step = 0; step < 20000; step++) {
        int s = rand() % IQ;
        if (m.valid >> s & 1) am_remove(&m, s);
        else { am_insert(&m, s); seq[s] = now++; }
        uint64_t rdy = ((uint64_t)rand() << 32 | (uint64_t)rand()) ^ ((uint64_t)rand() << 16);
        int got = am_select(&m, rdy), want = -1;
        for (int i = 0; i < IQ; i++)
            if ((m.valid & rdy) >> i & 1 && (want < 0 || seq[i] < seq[want])) want = i;
        if (got != want) bad++;
    }
    CHECK(bad == 0, "%d random selections disagreed with the reference", bad);

    return REPORT();
}`,
a: `<p>Insertion is one row write: the new entry is younger than everything valid, so its row is the valid vector. Removal clears its column in every row (in hardware, one bit-line). Selection is the elegant part: entry <em>i</em> is the oldest ready entry exactly when <code>older[i] &amp; ready</code> is zero. Hardware computes that AND-reduction for all rows in parallel, so picking the oldest of 64 costs a few gate delays regardless of how entries are scattered.</p>
<p>For <em>n</em> ports, repeat with the winner masked off. Hardware does this either as a cascade (slower) or by giving each port its own subset of entries, and real schedulers often only enforce oldest-first approximately for the second and later picks.</p>
<p>The alternative, keeping entries compacted in age order (shifting on every issue), burns power moving entries and limits size, which is why age matrices appear in large schedulers. The cost is N² bits: 64 × 64 = 4,096 bits for this queue.</p>`
});

C("intv-sched", "trace", {
lvl: "hard",
q: `<p>Simulate issue from a unified scheduler with Skylake-like ports, and find the cycle each instruction issues. All instructions are in the scheduler at cycle 0. In each cycle, go through the ready, unissued instructions oldest first and give each the lowest-numbered free port that can run it:</p>
<ul>
<li>ALU (latency 1): ports 0, 1, 5, 6</li>
<li>MUL (latency 3, pipelined): port 1</li>
<li>LOAD (latency 5): ports 2, 3</li>
</ul>
<p>An instruction is ready in cycle <em>c</em> when every source’s producer issued at least its latency earlier. Register −1 means none. Each port takes one instruction per cycle.</p>`,
head: String.raw`#include <stdio.h>

typedef enum { ALU, MUL, LOAD } op_t;
typedef struct { op_t op; int rd, rs1, rs2; } instr_t;

static const int LAT[] = { [ALU] = 1, [MUL] = 3, [LOAD] = 5 };
static const unsigned PORTS[] = { [ALU] = 1u << 0 | 1u << 1 | 1u << 5 | 1u << 6,
                                  [MUL] = 1u << 1, [LOAD] = 1u << 2 | 1u << 3 };
#define MAXN 64`,
todo: String.raw`void schedule(const instr_t *code, int n, int issue[]) {
    /* TODO */
}`,
impl: String.raw`void schedule(const instr_t *code, int n, int issue[]) {
    int producer[MAXN][2];
    int last_writer[32];
    for (int r = 0; r < 32; r++) last_writer[r] = -1;
    for (int i = 0; i < n; i++) {
        producer[i][0] = code[i].rs1 >= 0 ? last_writer[code[i].rs1] : -1;
        producer[i][1] = code[i].rs2 >= 0 ? last_writer[code[i].rs2] : -1;
        if (code[i].rd >= 0) last_writer[code[i].rd] = i;
        issue[i] = -1;
    }
    int left = n;
    for (int c = 0; left > 0; c++) {
        unsigned busy = 0;
        for (int i = 0; i < n; i++) {
            if (issue[i] >= 0) continue;
            int ready = 1;
            for (int k = 0; k < 2; k++) {
                int p = producer[i][k];
                /* The producer must have issued in an earlier cycle (not this one). */
                if (p >= 0 && (issue[p] < 0 || issue[p] == c || issue[p] + LAT[code[p].op] > c)) ready = 0;
            }
            unsigned free_ports = PORTS[code[i].op] & ~busy;
            if (!ready || !free_ports) continue;
            busy |= free_ports & -free_ports;   /* lowest free port */
            issue[i] = c;
            left--;
        }
    }
}`,
tests: String.raw`static void expect(const char *name, const instr_t *code, int n, const int *want) {
    int issue[MAXN];
    schedule(code, n, issue);
    for (int i = 0; i < n; i++)
        CHECK(issue[i] == want[i], "%s: I%d issues in cycle %d, expected %d", name, i, issue[i], want[i]);
}

int main(void) {
    instr_t five[] = { {ALU, 1, -1, -1}, {ALU, 2, -1, -1}, {ALU, 3, -1, -1}, {ALU, 4, -1, -1}, {ALU, 5, -1, -1} };
    expect("5 ALU ops on 4 ALU ports", five, 5, (int[]){0, 0, 0, 0, 1});

    instr_t mul_first[] = { {MUL, 1, -1, -1}, {ALU, 2, -1, -1}, {ALU, 3, -1, -1} };
    expect("MUL oldest", mul_first, 3, (int[]){0, 0, 0});

    instr_t mul_last[] = { {ALU, 1, -1, -1}, {ALU, 2, -1, -1}, {MUL, 3, -1, -1} };
    expect("ALU ops take port 1 from the MUL", mul_last, 3, (int[]){0, 0, 1});

    instr_t loads[] = { {LOAD, 1, 9, -1}, {LOAD, 2, 9, -1}, {LOAD, 3, 9, -1} };
    expect("3 loads, 2 load ports", loads, 3, (int[]){0, 0, 1});

    instr_t chain[] = { {LOAD, 1, 9, -1}, {MUL, 2, 1, 1}, {ALU, 3, 2, 1}, {ALU, 4, -1, -1} };
    expect("load, mul, add chain", chain, 4, (int[]){0, 5, 8, 0});

    instr_t muls[] = { {MUL, 1, -1, -1}, {MUL, 2, -1, -1}, {MUL, 3, 1, 2} };
    expect("MULs share port 1", muls, 3, (int[]){0, 1, 4});

    return REPORT();
}`,
a: `<p>Precompute each instruction’s producers with a last-writer table (this is what renaming gives the scheduler), then step cycles. In each cycle, scan oldest first, check readiness, and take the lowest set bit of the instruction’s allowed ports minus the busy ones (<code>x &amp; -x</code>).</p>
<p>The third check is the interview point: when two older ALU ops arrive first, the greedy lowest-port choice gives the second one port 1, and the MUL, which can only use port 1, waits a cycle even though ports 5 and 6 sat idle. Intel cores bind ports at allocation using counts of pending work per port to reduce this, and other designs give multiply-capable ports lower priority for simple ALU ops. A model that picks ports greedily at issue will overstate port conflicts on code that mixes ALU and multiply work.</p>
<p>The readiness test uses “issued at least latency cycles earlier,” which is back-to-back wakeup for 1-cycle ALU ops. A model with a one-cycle wakeup delay would add a bubble to every dependent pair and halve the speed of serial integer code.</p>`
});

C("intv-arith", "fmt", {
lvl: "hard",
q: `<p>Convert an FP32 bit pattern to FP16 (1 sign, 5 exponent, 10 fraction bits) using integer operations only, as a hardware converter or a model of one would. Match IEEE 754 exactly:</p>
<ul>
<li>Round to nearest, ties to even, including into and out of the subnormal range.</li>
<li>Values that round above 65504 become infinity.</li>
<li>Every NaN becomes a quiet NaN with the same sign: set the quiet bit (fraction bit 9) and keep the top 10 fraction bits of the input, so a signaling NaN never turns into infinity.</li>
</ul>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <string.h>`,
todo: String.raw`uint16_t f32_to_f16(uint32_t x) {
    /* TODO */
    return 0;
}`,
impl: String.raw`uint16_t f32_to_f16(uint32_t x) {
    uint32_t sign = (x >> 16) & 0x8000;
    int exp = (x >> 23) & 0xFF;
    uint32_t frac = x & 0x7FFFFF;

    if (exp == 0xFF)                       /* infinity or NaN */
        return sign | 0x7C00 | (frac ? 0x200 | (frac >> 13) : 0);

    int e = exp - 127 + 15;                /* rebias */
    if (e >= 31) return sign | 0x7C00;     /* far too big */

    uint32_t mant = frac | 0x800000;       /* 24-bit significand, implicit 1 */
    int shift = 13;                        /* bits to drop for a normal FP16 */
    if (e <= 0) {                          /* FP16 subnormal (or zero) */
        if (exp == 0) return sign;         /* FP32 zero or subnormal: below 2^-126 */
        shift = 14 - e;
        if (shift > 25) return sign;       /* below half the smallest subnormal */
        e = 0;
    }
    uint32_t kept = mant >> shift;
    uint32_t rest = mant & ((1u << shift) - 1), half = 1u << (shift - 1);
    if (rest > half || (rest == half && (kept & 1))) kept++;

    /* For normals, kept still holds the implicit 1 in bit 10. Adding the
       exponent field lets a rounding carry ripple from the fraction into
       the exponent (and from the top normal into infinity). */
    if (e == 0) return sign | kept;        /* a carry to 0x400 is the smallest normal */
    return sign | ((uint32_t)(e - 1) << 10) + kept;
}`,
tests: String.raw`static uint32_t bits(float f) { uint32_t u; memcpy(&u, &f, 4); return u; }
static float pow2(int k) { float f = 1; while (k > 0) { f *= 2; k--; } while (k < 0) { f /= 2; k++; } return f; }

static void expect(const char *name, uint32_t in, uint16_t want) {
    uint16_t got = f32_to_f16(in);
    CHECK(got == want, "%s (0x%08X): got 0x%04X, expected 0x%04X", name, (unsigned)in, got, want);
}

int main(void) {
    expect("1.0", bits(1.0f), 0x3C00);
    expect("-2.0", bits(-2.0f), 0xC000);
    expect("-0.0", bits(-0.0f), 0x8000);
    expect("65504, the largest FP16", bits(65504.0f), 0x7BFF);
    expect("65519 rounds down", bits(65519.0f), 0x7BFF);
    expect("65520 ties up to infinity", bits(65520.0f), 0x7C00);
    expect("1e10 overflows", bits(1e10f), 0x7C00);
    expect("1 + 2^-11 ties to even (down)", bits(1.0f + pow2(-11)), 0x3C00);
    expect("1 + 3*2^-11 ties to even (up)", bits(1.0f + 3 * pow2(-11)), 0x3C02);
    expect("2^-14, smallest normal", bits(pow2(-14)), 0x0400);
    expect("2^-24, smallest subnormal", bits(pow2(-24)), 0x0001);
    expect("2^-25 ties to even (zero)", bits(pow2(-25)), 0x0000);
    expect("0.75 * 2^-24 rounds up", bits(0.75f * pow2(-24)), 0x0001);
    expect("1.5 * 2^-24 ties to even (up)", bits(1.5f * pow2(-24)), 0x0002);
    expect("1023.5 * 2^-24 carries into the exponent", bits(1023.5f * pow2(-24)), 0x0400);
    expect("1e-8 underflows", bits(1e-8f), 0x0000);
    expect("FP32 subnormal", 0x00000001, 0x0000);
    expect("infinity", 0x7F800000, 0x7C00);
    expect("quiet NaN", 0x7FC00000, 0x7E00);
    expect("signaling NaN stays NaN", 0x7F800001, 0x7E00);
    expect("negative NaN with payload", 0xFFC02000, 0xFE01);
    expect("pi", bits(3.14159265f), 0x4248);
    return REPORT();
}`,
a: `<p>Split the input into sign, exponent, and fraction, then handle the cases in order:</p>
<ol>
<li><strong>Infinity and NaN</strong> (exponent all ones): keep infinity. For a NaN, OR in the quiet bit, because a signaling NaN whose payload sits only in the low 13 bits would otherwise truncate to an all-zero fraction, which is infinity.</li>
<li><strong>Rebias</strong> the exponent from 127 to 15. If it is 31 or more, the value overflows even before rounding.</li>
<li><strong>Choose how many bits to drop:</strong> 13 for a normal result. For a subnormal result, more: <code>14 − e</code>, where the implicit 1 is kept so it shifts down into the fraction.</li>
<li><strong>Round</strong> with the dropped bits: up if more than half, and on an exact half only if the kept value is odd.</li>
<li><strong>Assemble</strong> with an addition, not an OR. A carry out of the fraction then increments the exponent for free: 1023.5 × 2<sup>−24</sup> rounds from the largest subnormal to the smallest normal, and 65520 rounds into the infinity pattern.</li>
</ol>
<p>Converters in real hardware use exactly this guard, round, and sticky logic. In a performance model, the same care matters when you emulate low-precision formats for accuracy studies: a converter that truncates instead of rounding to nearest even biases every accumulated result.</p>`
});

C("intv-arith", "units", {
lvl: "hard",
q: `<p>Write the full 64 × 64 → 128-bit multiply that an integer multiplier produces, using only 64-bit arithmetic (no <code>__int128</code>), the way you would on a target without a wide multiply or in a model of a 32-bit datapath.</p>
<ul>
<li><code>umul128()</code>: unsigned product, high and low 64 bits.</li>
<li><code>smulh()</code>: the high 64 bits of the signed product (what Arm’s <code>SMULH</code> and x86’s one-operand <code>IMUL</code> return in the high half). Derive it from the unsigned product rather than multiplying signed values.</li>
</ul>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>`,
todo: String.raw`void umul128(uint64_t a, uint64_t b, uint64_t *hi, uint64_t *lo) {
    /* TODO */
}

int64_t smulh(int64_t a, int64_t b) {
    /* TODO */
    return 0;
}`,
impl: String.raw`void umul128(uint64_t a, uint64_t b, uint64_t *hi, uint64_t *lo) {
    uint64_t a0 = (uint32_t)a, a1 = a >> 32, b0 = (uint32_t)b, b1 = b >> 32;
    uint64_t p00 = a0 * b0, p01 = a0 * b1, p10 = a1 * b0, p11 = a1 * b1;
    /* Sum the middle column in 64 bits: each term is below 2^32, so the
       total is below 3 * 2^32 and can't overflow. */
    uint64_t mid = (p00 >> 32) + (uint32_t)p01 + (uint32_t)p10;
    *lo = (mid << 32) | (uint32_t)p00;
    *hi = p11 + (p01 >> 32) + (p10 >> 32) + (mid >> 32);
}

int64_t smulh(int64_t a, int64_t b) {
    uint64_t hi, lo;
    umul128((uint64_t)a, (uint64_t)b, &hi, &lo);
    /* Reading a negative number as unsigned adds 2^64, which adds the other
       operand to the high half. Subtract it back. */
    if (a < 0) hi -= (uint64_t)b;
    if (b < 0) hi -= (uint64_t)a;
    return (int64_t)hi;
}`,
tests: String.raw`static uint64_t rnd64(void) {
    return (uint64_t)rand() << 62 ^ (uint64_t)rand() << 31 ^ (uint64_t)rand();
}

int main(void) {
    uint64_t hi, lo, M = UINT64_MAX;
    umul128(M, M, &hi, &lo);
    CHECK(hi == M - 1 && lo == 1, "max * max: hi %llx lo %llx", (unsigned long long)hi, (unsigned long long)lo);
    umul128(1ull << 32, 1ull << 32, &hi, &lo);
    CHECK(hi == 1 && lo == 0, "2^32 * 2^32: hi %llx lo %llx", (unsigned long long)hi, (unsigned long long)lo);
    umul128(0xFFFFFFFFull, 0xFFFFFFFFull, &hi, &lo);
    CHECK(hi == 0 && lo == 0xFFFFFFFE00000001ull, "(2^32-1)^2: lo %llx", (unsigned long long)lo);
    CHECK(smulh(-1, -1) == 0, "smulh(-1, -1) = %lld", (long long)smulh(-1, -1));
    CHECK(smulh(-1, 1) == -1, "smulh(-1, 1) = %lld", (long long)smulh(-1, 1));
    CHECK(smulh(INT64_MIN, INT64_MIN) == 1ll << 62, "smulh(MIN, MIN) = %llx", (unsigned long long)smulh(INT64_MIN, INT64_MIN));
    CHECK(smulh(INT64_MIN, 2) == -1, "smulh(MIN, 2) = %lld", (long long)smulh(INT64_MIN, 2));

    /* Against the compiler's 128-bit type. */
    srand(3);
    int bad_u = 0, bad_s = 0;
    for (int i = 0; i < 200000; i++) {
        uint64_t a = rnd64(), b = rnd64();
        unsigned __int128 p = (unsigned __int128)a * b;
        umul128(a, b, &hi, &lo);
        if (hi != (uint64_t)(p >> 64) || lo != (uint64_t)p) bad_u++;
        __int128 q = (__int128)(int64_t)a * (int64_t)b;
        if (smulh((int64_t)a, (int64_t)b) != (int64_t)(q >> 64)) bad_s++;
    }
    CHECK(bad_u == 0, "%d random unsigned products were wrong", bad_u);
    CHECK(bad_s == 0, "%d random signed high halves were wrong", bad_s);
    return REPORT();
}`,
a: `<p>Split each operand into 32-bit halves, so <em>a</em> × <em>b</em> = <em>a</em><sub>1</sub><em>b</em><sub>1</sub>·2<sup>64</sup> + (<em>a</em><sub>1</sub><em>b</em><sub>0</sub> + <em>a</em><sub>0</sub><em>b</em><sub>1</sub>)·2<sup>32</sup> + <em>a</em><sub>0</sub><em>b</em><sub>0</sub>. Each partial product fits in 64 bits. The only trap is the carry out of the middle column: add the low halves of the two cross products to the high half of <em>a</em><sub>0</sub><em>b</em><sub>0</sub> in a 64-bit sum (at most 3 × (2<sup>32</sup> − 1), so it can’t overflow), then the sum’s upper bits carry into the high word. Adding the full cross products first overflows on inputs like max × max.</p>
<p>For the signed high half, a negative operand read as unsigned is <em>a</em> + 2<sup>64</sup>, which adds <em>b</em> · 2<sup>64</sup> to the product, so subtract <em>b</em> from the high word (and likewise for <em>b</em>). The low word is the same signed or unsigned, which is why ISAs have one low-multiply but separate signed and unsigned high-multiplies.</p>
<p>Hardware does the same decomposition at a finer grain: a Booth-encoded partial-product array reduced by a Wallace or Dadda tree, then one carry-propagate add. That is why a 64-bit multiply has 3 to 4 cycles of latency but is fully pipelined.</p>`
});

C("intv-branch", "predictors", {
lvl: "hard",
q: `<p>Implement a gshare predictor and measure it on synthetic branch patterns.</p>
<ul>
<li>A table of 2<sup><code>index_bits</code></sup> two-bit counters, all starting at 1 (weakly not taken). Predict taken when a counter is 2 or 3.</li>
<li>Global history holds the last <code>hist_bits</code> outcomes, newest in bit 0 (1 = taken). <code>hist_bits</code> ≤ <code>index_bits</code>, and 0 makes the predictor bimodal.</li>
<li>Index = ((pc &gt;&gt; 2) XOR history), masked to <code>index_bits</code>.</li>
<li><code>gs_update()</code> trains the counter that made the prediction, then shifts the outcome into the history.</li>
</ul>
<p>Then write <code>run()</code>, which predicts and updates a trace and returns the number of mispredictions.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

typedef struct {
    uint8_t *ctr;
    uint32_t hist;
    int index_bits, hist_bits;
} gshare_t;`,
todo: String.raw`void gs_init(gshare_t *g, int index_bits, int hist_bits) {
    /* TODO */
}

int gs_predict(const gshare_t *g, uint32_t pc) {
    /* TODO */
    return 0;
}

void gs_update(gshare_t *g, uint32_t pc, int taken) {
    /* TODO */
}

int run(gshare_t *g, const uint32_t *pc, const uint8_t *taken, int n) {
    /* TODO */
    return 0;
}`,
impl: String.raw`static uint32_t gs_index(const gshare_t *g, uint32_t pc) {
    uint32_t h = g->hist & ((1u << g->hist_bits) - 1);
    return ((pc >> 2) ^ h) & ((1u << g->index_bits) - 1);
}

void gs_init(gshare_t *g, int index_bits, int hist_bits) {
    g->index_bits = index_bits;
    g->hist_bits = hist_bits;
    g->hist = 0;
    g->ctr = malloc(1u << index_bits);
    for (uint32_t i = 0; i < 1u << index_bits; i++) g->ctr[i] = 1;
}

int gs_predict(const gshare_t *g, uint32_t pc) {
    return g->ctr[gs_index(g, pc)] >= 2;
}

void gs_update(gshare_t *g, uint32_t pc, int taken) {
    uint8_t *c = &g->ctr[gs_index(g, pc)];   /* index with the old history */
    if (taken && *c < 3) (*c)++;
    if (!taken && *c > 0) (*c)--;
    g->hist = (g->hist << 1) | (taken != 0);
}

int run(gshare_t *g, const uint32_t *pc, const uint8_t *taken, int n) {
    int miss = 0;
    for (int i = 0; i < n; i++) {
        miss += gs_predict(g, pc[i]) != taken[i];
        gs_update(g, pc[i], taken[i]);
    }
    return miss;
}`,
tests: String.raw`#define N 8000
static uint32_t pc[N];
static uint8_t tk[N];

static int measure(int index_bits, int hist_bits) {
    gshare_t g;
    gs_init(&g, index_bits, hist_bits);
    int m = run(&g, pc, tk, N);
    free(g.ctr);
    return m;
}

int main(void) {
    /* Always taken: every new history value seen during warm-up costs one
       miss (history 0, 1, 11, ..., all ones), then it is perfect. */
    for (int i = 0; i < N; i++) { pc[i] = 0x401000; tk[i] = 1; }
    CHECK(measure(14, 12) == 13, "always taken, 12 history bits: %d misses, expected 13", measure(14, 12));
    CHECK(measure(14, 0) == 1, "always taken, bimodal: %d misses, expected 1", measure(14, 0));

    /* Alternating T, N: bimodal gets every one wrong, history learns it. */
    for (int i = 0; i < N; i++) tk[i] = !(i & 1);
    CHECK(measure(14, 0) == N, "alternating, bimodal: %d misses, expected %d", measure(14, 0), N);
    CHECK(measure(14, 8) <= 10, "alternating, 8 history bits: %d misses, expected at most 10", measure(14, 8));

    /* A loop branch taken 7 times then not taken, 1,000 times. */
    for (int i = 0; i < N; i++) tk[i] = (i % 8) != 7;
    CHECK(measure(14, 0) == 1001, "loop exit, bimodal: %d misses, expected 1001", measure(14, 0));
    CHECK(measure(14, 12) <= 30, "loop exit, 12 history bits: %d misses, expected at most 30", measure(14, 12));
    CHECK(measure(14, 4) > 900, "loop of 8 with only 4 history bits should still miss the exit: %d", measure(14, 4));

    /* Two branches whose outcomes are correlated: B copies A, A random. */
    srand(9);
    for (int i = 0; i < N; i += 2) {
        pc[i] = 0x401000; tk[i] = rand() & 1;
        pc[i + 1] = 0x401040; tk[i + 1] = tk[i];
    }
    int m = measure(14, 4);
    CHECK(m > 1700 && m < 2300, "correlated pair: %d misses, expected about 2000 (A only)", m);
    return REPORT();
}`,
a: `<p>The details that trip people up: train the counter that made the prediction, so index with the history from before this outcome, and only then shift the outcome in. Saturate the counters at 0 and 3.</p>
<p>What the checks show:</p>
<ul>
<li><strong>Always taken:</strong> with 12 history bits, the warm-up passes through 13 different history values (0, 1, 11, up to twelve 1s), each with a fresh weakly-not-taken counter, so 13 misses. History has a training cost on every new pattern.</li>
<li><strong>Alternating:</strong> a bimodal counter flips between 1 and 2 and is wrong every time. One bit of history separates the two cases, so gshare is right after warm-up.</li>
<li><strong>Loop exit:</strong> to predict the exit of an 8-iteration loop, the history must reach back past 7 taken outcomes. With 12 bits it does, and only warm-up misses remain. With 4 bits, the history before the exit looks like every other iteration, so it misses about once per loop, just like bimodal.</li>
<li><strong>Correlation:</strong> branch A is random and can’t be predicted, but B equals A, and the history’s newest bit is A’s outcome, so B is predicted perfectly. Misses are about half of A’s 4,000 executions.</li>
</ul>
<p>Real predictors such as TAGE keep several tables with geometrically longer histories, so short patterns train fast and long ones are still caught. Gshare’s single XOR-hashed table makes unrelated branches share counters, which is the aliasing that tagged tables reduce.</p>`
});

C("intv-branch", "spec", {
lvl: "hard",
q: `<p>Implement a 16-entry return address stack that the front end updates speculatively, with the usual cheap repair. A call pushes its return address and a return pops a prediction, both at prediction time, so a mispredicted path can corrupt the stack.</p>
<ul>
<li>It is circular: a push onto a full stack overwrites the oldest entry. Track how many entries are valid (at most 16). <code>ras_pop()</code> on an empty stack returns 0, meaning no prediction.</li>
<li><code>ras_checkpoint()</code> runs at every predicted branch and saves the top-of-stack pointer, the valid count, and the top entry’s value. <code>ras_restore()</code> puts back those three things after a mispredict, and nothing else.</li>
</ul>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>

#define RAS 16

typedef struct {
    uint64_t e[RAS];
    int tos;     /* slot of the next push */
    int count;   /* valid entries */
} ras_t;

typedef struct { int tos, count; uint64_t top; } ras_ckpt_t;`,
todo: String.raw`void ras_init(ras_t *r) {
    /* TODO */
}

void ras_push(ras_t *r, uint64_t ret) {
    /* TODO */
}

uint64_t ras_pop(ras_t *r) {
    /* TODO */
    return 0;
}

ras_ckpt_t ras_checkpoint(const ras_t *r) {
    ras_ckpt_t c = {0};
    /* TODO */
    return c;
}

void ras_restore(ras_t *r, ras_ckpt_t c) {
    /* TODO */
}`,
impl: String.raw`void ras_init(ras_t *r) { r->tos = 0; r->count = 0; }

void ras_push(ras_t *r, uint64_t ret) {
    r->e[r->tos] = ret;
    r->tos = (r->tos + 1) % RAS;
    if (r->count < RAS) r->count++;
}

uint64_t ras_pop(ras_t *r) {
    if (r->count == 0) return 0;
    r->tos = (r->tos + RAS - 1) % RAS;
    r->count--;
    return r->e[r->tos];
}

ras_ckpt_t ras_checkpoint(const ras_t *r) {
    ras_ckpt_t c = { r->tos, r->count, r->e[(r->tos + RAS - 1) % RAS] };
    return c;
}

void ras_restore(ras_t *r, ras_ckpt_t c) {
    r->tos = c.tos;
    r->count = c.count;
    r->e[(c.tos + RAS - 1) % RAS] = c.top;
}`,
tests: String.raw`int main(void) {
    ras_t r;
    ras_init(&r);
    CHECK(ras_pop(&r) == 0, "an empty stack must give no prediction");

    /* Recursion 20 deep: the 16 innermost returns are right, then the
       stack is empty instead of returning garbage. */
    for (int d = 0; d < 20; d++) ras_push(&r, 0x1000 + d);
    int right = 0, none = 0;
    for (int d = 19; d >= 0; d--) {
        uint64_t p = ras_pop(&r);
        if (p == (uint64_t)(0x1000 + d)) right++;
        if (p == 0) none++;
    }
    CHECK(right == 16 && none == 4, "20-deep recursion: %d right, %d empty, expected 16 and 4", right, none);

    /* Wrong path pops one return and pushes a call: the repair fixes it. */
    ras_init(&r);
    ras_push(&r, 0xA); ras_push(&r, 0xB);
    ras_ckpt_t c = ras_checkpoint(&r);
    CHECK(ras_pop(&r) == 0xB, "wrong-path pop should predict 0xB");
    ras_push(&r, 0xBAD);       /* overwrites the slot that held 0xB */
    ras_push(&r, 0xBAD2);
    ras_restore(&r, c);
    uint64_t p1 = ras_pop(&r), p2 = ras_pop(&r);
    CHECK(p1 == 0xB && p2 == 0xA, "after repair: 0x%llx, 0x%llx, expected 0xB, 0xA", (unsigned long long)p1, (unsigned long long)p2);

    /* Two wrong-path pops then a push corrupt a deeper entry: the cheap
       repair restores only the top, so the second return is wrong. */
    ras_init(&r);
    ras_push(&r, 0xA); ras_push(&r, 0xB);
    c = ras_checkpoint(&r);
    ras_pop(&r); ras_pop(&r);
    ras_push(&r, 0xBAD);       /* overwrites 0xA's slot */
    ras_restore(&r, c);
    p1 = ras_pop(&r); p2 = ras_pop(&r);
    CHECK(p1 == 0xB && p2 == 0xBAD, "deep corruption: 0x%llx, 0x%llx, expected 0xB then 0xBAD", (unsigned long long)p1, (unsigned long long)p2);

    /* Restoring the count matters: a wrong path that pops the stack empty. */
    ras_init(&r);
    ras_push(&r, 0xC);
    c = ras_checkpoint(&r);
    ras_pop(&r);
    CHECK(ras_pop(&r) == 0, "the wrong path sees an empty stack");
    ras_restore(&r, c);
    CHECK(ras_pop(&r) == 0xC, "after repair the stack holds 0xC again");
    return REPORT();
}`,
a: `<p>A call’s return address is the most predictable target there is, as long as the stack matches the program’s call depth. Two things break it:</p>
<ul>
<li><strong>Overflow:</strong> deeper recursion than the stack size overwrites the oldest entries. Tracking a valid count lets the stack say “no prediction” instead of returning a stale address from the other end of the circle.</li>
<li><strong>Wrong-path updates:</strong> the front end pushes and pops before branches resolve. Saving the pointer at each branch fixes pure pushes and pops. Saving the top entry too fixes the common pop-then-push case, where a wrong-path call overwrites the entry the correct path will pop next (Skadron et al., 1998).</li>
</ul>
<p>The third check shows the limit: if the wrong path pops twice and then pushes, it overwrites an entry below the saved top, and the repair can’t see it. Fixing that needs a full copy per checkpoint or a linked-list stack that never overwrites live entries, which some recent cores use. In a model, the misprediction cost of returns on deep, recursive, or exception-heavy code depends directly on which of these schemes you assume.</p>`
});

C("intv-fe", "fetch", {
lvl: "medium",
q: `<p>Count fetch cycles for a stream of basic blocks. The fetch unit reads up to one aligned <code>window</code>-byte chunk per cycle (32 bytes on Golden Cove and Zen 4). A cycle’s fetch stops at the end of the aligned window, or right after a taken branch, whichever comes first, and the next cycle starts at the next address or the branch target.</p>
<p>Block <em>i</em> starts at <code>start</code> and is <code>len</code> bytes long. If <code>taken</code> is set it ends in a taken branch to block <em>i</em> + 1. Otherwise block <em>i</em> + 1 starts right after it and fetch simply continues. Return the total fetch cycles.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>

typedef struct { uint32_t start, len; int taken; } block_t;`,
todo: String.raw`long fetch_cycles(const block_t *b, int n, uint32_t window) {
    /* TODO */
    return 0;
}`,
impl: String.raw`long fetch_cycles(const block_t *b, int n, uint32_t window) {
    long cycles = 0;
    int open = 0;   /* a cycle is still fetching from the current window */
    for (int i = 0; i < n; i++) {
        uint32_t first = b[i].start / window, last = (b[i].start + b[i].len - 1) / window;
        /* The first window is already being fetched if we fell through into
           it from the previous block in the same window. */
        cycles += (last - first + 1) - (open && i > 0 && first == (b[i - 1].start + b[i - 1].len - 1) / window);
        /* Fetch continues in the same cycle only if this block falls through
           and doesn't end exactly on a window boundary. */
        open = !b[i].taken && (b[i].start + b[i].len) % window != 0;
    }
    return cycles;
}`,
tests: String.raw`int main(void) {
    block_t a[] = { {0x1000, 20, 1}, {0x2000, 20, 1} };
    CHECK(fetch_cycles(a, 2, 32) == 2, "two aligned 20-byte blocks: %ld, expected 2", fetch_cycles(a, 2, 32));

    block_t b[] = { {0x101C, 20, 1} };
    CHECK(fetch_cycles(b, 1, 32) == 2, "20 bytes crossing a boundary: %ld, expected 2", fetch_cycles(b, 1, 32));

    /* A 16-byte loop body at 0x1018 crosses a boundary, at 0x1020 it doesn't. */
    block_t loop1[100], loop2[100];
    for (int i = 0; i < 100; i++) { loop1[i] = (block_t){0x1018, 16, 1}; loop2[i] = (block_t){0x1020, 16, 1}; }
    CHECK(fetch_cycles(loop1, 100, 32) == 200, "misaligned loop: %ld, expected 200", fetch_cycles(loop1, 100, 32));
    CHECK(fetch_cycles(loop2, 100, 32) == 100, "aligned loop: %ld, expected 100", fetch_cycles(loop2, 100, 32));

    /* Fall-through blocks share windows. */
    block_t ft[] = { {0x1000, 10, 0}, {0x100A, 10, 0}, {0x1014, 30, 1} };
    CHECK(fetch_cycles(ft, 3, 32) == 2, "fall-through chain: %ld, expected 2", fetch_cycles(ft, 3, 32));
    block_t edge[] = { {0x1000, 32, 0}, {0x1020, 8, 1} };
    CHECK(fetch_cycles(edge, 2, 32) == 2, "fall-through at a window edge: %ld, expected 2", fetch_cycles(edge, 2, 32));
    block_t tk[] = { {0x1000, 8, 1}, {0x1008, 8, 1} };
    CHECK(fetch_cycles(tk, 2, 32) == 2, "taken branch into the same window: %ld, expected 2", fetch_cycles(tk, 2, 32));
    CHECK(fetch_cycles(a, 2, 64) == 2, "64-byte windows: %ld, expected 2", fetch_cycles(a, 2, 64));
    return REPORT();
}`,
a: `<p>Each block costs one cycle per aligned window it touches: <code>last − first + 1</code>, from the windows of its first and last byte. The only subtlety is a block that falls through: the next block continues in the same cycle if it starts in the window that is still being fetched. That holds unless the previous block ended exactly at the window’s end, in which case the next window needs a new cycle anyway.</p>
<p>A taken branch always ends the cycle, even when its target is in the same window. A 16-byte loop body that straddles a 32-byte boundary therefore takes 2 fetch cycles per iteration instead of 1, halving front-end throughput for that loop when it runs from the I-cache. Compilers align hot loop heads to 16 or 32 bytes for this reason, and the uop cache or loop buffer hides much of it on modern cores.</p>`
});

C("intv-fe", "prefetch", {
lvl: "hard",
q: `<p>Model a decoupled front end and measure what fetch-directed instruction prefetching (FDIP) buys. A branch predictor puts one fetch block per cycle into a fetch target queue (FTQ) of <code>q</code> entries, and fetch takes one block per cycle from the head. Block <em>i</em>’s cache line misses if <code>miss[i]</code> is set, and a fill takes <code>lat</code> cycles. Each cycle <em>c</em>:</p>
<ol>
<li><strong>Fetch:</strong> if the head block’s line is present (no miss, or its fill finished by cycle <em>c</em>), take it out of the FTQ. If it misses and no fill has started, start one now.</li>
<li><strong>Predict:</strong> if the FTQ has space and blocks remain, add the next block. With <code>fdip</code> set, a block that misses starts its fill as soon as it enters the FTQ.</li>
</ol>
<p>A block added in cycle <em>c</em> can be fetched from cycle <em>c</em> + 1. Return the cycle the last block is fetched, plus 1.</p>`,
head: String.raw`#include <stdio.h>
#include <stdlib.h>`,
todo: String.raw`long frontend(const int *miss, int n, int q, int lat, int fdip) {
    /* TODO */
    return 0;
}`,
impl: String.raw`long frontend(const int *miss, int n, int q, int lat, int fdip) {
    long *ready = malloc(sizeof(long) * n);   /* -1: no fill started yet */
    int head = 0, tail = 0;                   /* FTQ holds blocks head..tail-1 */
    long c = 0, last = 0;
    while (head < n) {
        if (head < tail) {
            if (!miss[head] || (ready[head] >= 0 && ready[head] <= c)) { last = c; head++; }
            else if (ready[head] < 0) ready[head] = c + lat;
        }
        if (tail < n && tail - head < q) {
            ready[tail] = (miss[tail] && fdip) ? c + lat : -1;
            tail++;
        }
        c++;
    }
    free(ready);
    return last + 1;
}`,
tests: String.raw`static long go(const char *pattern, int q, int lat, int fdip) {
    int n = 0, miss[64];
    for (const char *p = pattern; *p; p++) miss[n++] = *p == 'M';
    return frontend(miss, n, q, lat, fdip);
}

int main(void) {
    CHECK(go("....", 4, 10, 0) == 5, "no misses: %ld cycles, expected 5", go("....", 4, 10, 0));
    CHECK(go("..M.", 4, 10, 0) == 15, "one miss, no FDIP: %ld, expected 15", go("..M.", 4, 10, 0));
    CHECK(go("..M.", 4, 10, 1) == 14, "one miss, FDIP: %ld, expected 14", go("..M.", 4, 10, 1));
    CHECK(go("..MM", 4, 10, 0) == 25, "two misses, no FDIP: %ld, expected 25", go("..MM", 4, 10, 0));
    CHECK(go("..MM", 4, 10, 1) == 14, "two misses, FDIP overlaps them: %ld, expected 14", go("..MM", 4, 10, 1));
    CHECK(go("..M..M", 2, 10, 1) == 24, "FTQ of 2 can't reach the second miss: %ld, expected 24", go("..M..M", 2, 10, 1));
    CHECK(go("..M..M", 8, 10, 1) == 16, "FTQ of 8 reaches it: %ld, expected 16", go("..M..M", 8, 10, 1));

    /* A server-like stream: 1 block in 8 misses, 30-cycle L2 hits. */
    char big[65];
    for (int i = 0; i < 64; i++) big[i] = i % 8 == 3 ? 'M' : '.';
    big[64] = 0;
    long off = go(big, 24, 30, 0), on = go(big, 24, 30, 1);
    CHECK(off == 305 && on == 106, "64 blocks: %ld without FDIP and %ld with, expected 305 and 106", off, on);
    return REPORT();
}`,
a: `<p>The loop is short once the order within a cycle is fixed: fetch first, then predict, so a block can’t be added and fetched in the same cycle, and space freed by fetch is reusable at once.</p>
<p>What the checks show:</p>
<ul>
<li>With one isolated miss, FDIP saves only one cycle, because the predictor is just one block ahead of fetch when nothing stalls.</li>
<li>FDIP pays off when misses are close together: while fetch waits on the first miss, the predictor keeps filling the FTQ and starts the second fill, so the two latencies overlap (14 cycles instead of 25).</li>
<li>The FTQ size is the prefetch distance. With 2 entries, the predictor stops before it reaches the second miss. With 8, it reaches it during the first stall.</li>
<li>On the 64-block stream, with a 30-cycle fill every 8 blocks, the 24-entry FTQ hides two of every three misses completely and part of the third: 106 cycles instead of 305.</li>
</ul>
<p>This is why modern cores decouple the predictor from fetch with a deep queue (Golden Cove and Zen 4 run the predictor well ahead of the I-cache), and why BTB capacity matters for instruction prefetch: the predictor can only run ahead through branches it knows about.</p>`
});

C("intv-lsq", "fwd", {
lvl: "hard",
q: `<p>Decide what a load gets from the store queue. <code>sq</code> holds the stores older than the load, oldest first. Each byte of the load comes from the youngest store that writes it, or from memory if none does. Return:</p>
<ul>
<li><strong>FWD_NONE</strong> if no store writes any of the load’s bytes. Set <code>*out</code> from <code>mem</code>, the load’s bytes in memory.</li>
<li><strong>FWD_FULL</strong> if one store supplies every byte, its address and data are known, and it contains the whole load. Set <code>*out</code> to those bytes (little-endian, zero-extended).</li>
<li><strong>FWD_STALL</strong> otherwise: any older store with an unknown address, bytes from more than one store, a mix of store and memory bytes, or a supplying store whose data isn’t ready. The load waits for the stores to drain.</li>
</ul>
<p>Sizes are 1, 2, 4, or 8 bytes, and accesses may be unaligned.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>

typedef struct {
    uint32_t addr;
    int size;
    uint64_t data;
    int addr_ok, data_ok;
} sq_entry_t;

typedef enum { FWD_NONE, FWD_FULL, FWD_STALL } fwd_t;`,
todo: String.raw`fwd_t load_lookup(const sq_entry_t *sq, int n, uint32_t addr, int size,
                  uint64_t mem, uint64_t *out) {
    /* TODO */
    return FWD_STALL;
}`,
impl: String.raw`fwd_t load_lookup(const sq_entry_t *sq, int n, uint32_t addr, int size,
                  uint64_t mem, uint64_t *out) {
    for (int s = 0; s < n; s++)
        if (!sq[s].addr_ok) return FWD_STALL;   /* can't rule out an overlap */
    int src[8], from_store = 0;
    for (int b = 0; b < size; b++) {
        src[b] = -1;
        for (int s = n - 1; s >= 0; s--) {      /* youngest first */
            uint32_t a = addr + b;
            if (a - sq[s].addr < (uint32_t)sq[s].size) { src[b] = s; break; }
        }
        from_store += src[b] >= 0;
    }
    uint64_t mask = size == 8 ? ~0ull : (1ull << (8 * size)) - 1;
    if (from_store == 0) { *out = mem & mask; return FWD_NONE; }
    for (int b = 1; b < size; b++)
        if (src[b] != src[0]) return FWD_STALL;  /* two stores, or store and memory */
    const sq_entry_t *st = &sq[src[0]];
    if (src[0] < 0 || !st->data_ok) return FWD_STALL;
    *out = (st->data >> (8 * (addr - st->addr))) & mask;
    return FWD_FULL;
}`,
tests: String.raw`static const char *name[] = {"NONE", "FULL", "STALL"};

static void expect(const char *what, const sq_entry_t *sq, int n, uint32_t addr, int size,
                   fwd_t want, uint64_t want_val) {
    uint64_t v = 0xDEAD;
    fwd_t r = load_lookup(sq, n, addr, size, 0x1122334455667788ull, &v);
    CHECK(r == want, "%s: got %s, expected %s", what, name[r], name[want]);
    if (r == want && want != FWD_STALL)
        CHECK(v == want_val, "%s: value 0x%llx, expected 0x%llx", what, (unsigned long long)v, (unsigned long long)want_val);
}

int main(void) {
    sq_entry_t one[] = { {0x100, 8, 0x0807060504030201ull, 1, 1} };
    expect("same address and size", one, 1, 0x100, 8, FWD_FULL, 0x0807060504030201ull);
    expect("upper half of an 8-byte store", one, 1, 0x104, 4, FWD_FULL, 0x08070605);
    expect("unaligned 2 bytes inside", one, 1, 0x103, 2, FWD_FULL, 0x0504);
    expect("no overlap reads memory", one, 1, 0x108, 4, FWD_NONE, 0x55667788);
    expect("straddles the store's end", one, 1, 0x106, 4, FWD_STALL, 0);

    sq_entry_t two[] = { {0x200, 4, 0xAABBCCDD, 1, 1}, {0x204, 4, 0x11223344, 1, 1} };
    expect("8-byte load over two 4-byte stores", two, 2, 0x200, 8, FWD_STALL, 0);
    expect("4-byte load from the younger store", two, 2, 0x204, 4, FWD_FULL, 0x11223344);

    sq_entry_t over[] = { {0x300, 8, 0x0807060504030201ull, 1, 1}, {0x302, 2, 0xEEFF, 1, 1} };
    expect("younger store covers the load", over, 2, 0x302, 2, FWD_FULL, 0xEEFF);
    expect("bytes from both stores", over, 2, 0x300, 4, FWD_STALL, 0);
    expect("older store only", over, 2, 0x304, 4, FWD_FULL, 0x08070605);

    sq_entry_t unk[] = { {0x400, 4, 1, 1, 1}, {0, 8, 0, 0, 0} };
    expect("an older store's address is unknown", unk, 2, 0x900, 4, FWD_STALL, 0);

    sq_entry_t nodata[] = { {0x500, 4, 0, 1, 0} };
    expect("supplying store's data isn't ready", nodata, 1, 0x500, 4, FWD_STALL, 0);
    expect("non-overlapping store with no data", nodata, 1, 0x504, 4, FWD_NONE, 0x55667788);

    sq_entry_t wrap[] = { {0xFFFFFFFC, 4, 0x01020304, 1, 1} };
    expect("store at the top of the address space", wrap, 1, 0x0, 4, FWD_NONE, 0x55667788);
    return REPORT();
}`,
a: `<p>Work byte by byte: for each byte of the load, scan the older stores from youngest to oldest and stop at the first one that covers it. The unsigned comparison <code>a − st.addr &lt; st.size</code> checks containment in one step and can’t be fooled by wraparound at the top of the address space.</p>
<p>Then classify. No covered bytes means read memory. If every byte names the same store, that store contains the load and can forward, provided its data is ready. Anything else stalls. A store with an unknown address stalls every younger load in this conservative model. Real cores instead predict that the load is independent (memory dependence prediction) and replay it if a store later turns out to overlap.</p>
<p>The rule “one store must contain the whole load” mirrors the forwarding rules in Intel’s and AMD’s optimization manuals. A load that spans two stores, or a narrow store followed by a wide load, can’t forward and waits until the stores commit, which costs on the order of 10 or more cycles. This is a classic performance bug in code that writes a struct field by field and then copies it as a whole.</p>`
});

C("intv-lsq", "mlp", {
lvl: "hard",
q: `<p>Model a non-blocking cache’s miss status holding registers (MSHRs). Requests to <code>addr</code> arrive at cycle <code>arrive[i]</code> and are handled one per cycle in order. A request issues at the later of its arrival and one cycle after the previous request issued. At issue time <em>t</em>:</p>
<ul>
<li>If its 64-byte line has been filled by cycle <em>t</em>, it hits and finishes at <em>t</em> + <code>HIT</code>.</li>
<li>Else, if an MSHR is filling that line and has fewer than <code>TARGETS</code> requests, it merges and finishes when the fill does.</li>
<li>Else, if that line’s MSHR is full of requests, the request (and every later one) stalls until the fill completes, then issues as a hit.</li>
<li>Else it needs a free MSHR: it allocates one and finishes at <em>t</em> + <code>MISS</code>, when the line is filled and the MSHR frees. If none is free, it stalls until the earliest fill completes, then tries again.</li>
</ul>
<p>Fill <code>done[i]</code> for each request. The cache is large enough that filled lines stay.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>

#define HIT 4
#define MISS 100
#define TARGETS 2
#define MAXLINES 256`,
todo: String.raw`void run_mshrs(const uint32_t *addr, const long *arrive, int n, int mshrs, long done[]) {
    /* TODO */
}`,
impl: String.raw`void run_mshrs(const uint32_t *addr, const long *arrive, int n, int mshrs, long done[]) {
    uint32_t line[MAXLINES];  /* every line ever requested */
    long fill[MAXLINES];      /* cycle its fill completes */
    int targets[MAXLINES], nlines = 0;
    long t = 0;
    for (int i = 0; i < n; i++) {
        t = i == 0 ? arrive[0] : (arrive[i] > t + 1 ? arrive[i] : t + 1);
        uint32_t l = addr[i] / 64;
        int k = 0;
        while (k < nlines && line[k] != l) k++;
        for (;;) {
            if (k < nlines && fill[k] <= t) { done[i] = t + HIT; break; }
            if (k < nlines) {
                if (targets[k] < TARGETS) { targets[k]++; done[i] = fill[k]; break; }
                t = fill[k];                    /* wait for the fill, then hit */
                continue;
            }
            int busy = 0;
            long first = -1;
            for (int j = 0; j < nlines; j++)
                if (fill[j] > t) { busy++; if (first < 0 || fill[j] < first) first = fill[j]; }
            if (busy < mshrs) {
                line[nlines] = l; fill[nlines] = t + MISS; targets[nlines] = 1;
                done[i] = t + MISS;
                nlines++;
                break;
            }
            t = first;                          /* stall for a free MSHR */
        }
    }
}`,
tests: String.raw`static void expect(const char *what, const uint32_t *a, const long *arr, int n, int m, const long *want) {
    long done[16];
    run_mshrs(a, arr, n, m, done);
    for (int i = 0; i < n; i++)
        CHECK(done[i] == want[i], "%s: request %d done at %ld, expected %ld", what, i, done[i], want[i]);
}

int main(void) {
    uint32_t abc[] = {0x1000, 0x2000, 0x3000};
    expect("3 lines, 2 MSHRs", abc, (long[]){0, 1, 2}, 3, 2, (long[]){100, 101, 200});
    expect("3 lines, 4 MSHRs", abc, (long[]){0, 1, 2}, 3, 4, (long[]){100, 101, 102});

    uint32_t same[] = {0x1000, 0x1008, 0x1010, 0x1018};
    expect("4 requests to one line, 2 targets", same, (long[]){0, 1, 2, 3}, 4, 2, (long[]){100, 100, 104, 105});

    uint32_t later[] = {0x1000, 0x1000};
    expect("hit after the fill", later, (long[]){0, 150}, 2, 2, (long[]){100, 154});

    /* A blocked request blocks everything behind it (in order). */
    uint32_t hol[] = {0x1000, 0x2000, 0x3000, 0x1000};
    expect("head-of-line blocking", hol, (long[]){0, 1, 2, 3}, 4, 2, (long[]){100, 101, 200, 105});

    /* Streaming 16 lines with 1, 4, and 16 MSHRs: memory-level parallelism. */
    uint32_t s[16];
    long arr[16], d[16];
    for (int i = 0; i < 16; i++) { s[i] = 0x10000 + 64 * i; arr[i] = i; }
    int ms[3] = {1, 4, 16};
    long want_last[3] = {1600, 403, 115};
    for (int k = 0; k < 3; k++) {
        run_mshrs(s, arr, 16, ms[k], d);
        CHECK(d[15] == want_last[k], "16-line stream, %d MSHRs: last done at %ld, expected %ld", ms[k], d[15], want_last[k]);
    }
    return REPORT();
}`,
a: `<p>Keep one record per line: when its fill completes and how many requests it has collected. Then each request runs the four rules in order inside a retry loop. Stalling just moves <em>t</em> forward to the cycle that unblocks it (a fill completing) and retries, and because the next request can issue no earlier than <em>t</em> + 1, a stall blocks everything behind it, like a cache with in-order miss handling.</p>
<p>Check the cases by hand:</p>
<ul>
<li>Two MSHRs and three lines: the third miss waits until cycle 100 for a free MSHR, so it finishes at 200.</li>
<li>Four requests to one line with 2 targets: two merge into the fill at 100. The third finds the MSHR full, waits for the fill, and hits at 104. The fourth issues a cycle later and hits at 105.</li>
<li>The 16-line stream is the MLP lesson. One MSHR serializes the misses (16 × 100 = 1,600 cycles). Four overlap four at a time, and the last finishes at 403. Sixteen overlap them all, and the last one finishes at 15 + 100 = 115.</li>
</ul>
<p>Little’s law sets the MSHR count you need: bandwidth = outstanding misses × 64 B ÷ latency. Sustaining 64 B per cycle at 100 cycles of latency needs 100 misses in flight, which is why L2 and L3 caches and memory controllers have many more miss buffers than the L1D’s 16 to 24 fill buffers.</p>`
});

C("intv-mem", "cache", {
lvl: "medium",
q: `<p>Implement tree pseudo-LRU replacement for one cache set with <code>ways</code> ways, a power of two from 2 to 64 (Skylake’s L1D is 8-way, Zen 4’s L3 is 16-way).</p>
<ul>
<li>Keep the state in the low <code>ways − 1</code> bits of a <code>uint64_t</code>. Node 0 is the root, the children of node <em>i</em> are nodes 2<em>i</em> + 1 (left) and 2<em>i</em> + 2 (right), and the leaves are ways 0 to <code>ways − 1</code>, left to right.</li>
<li>A node bit of 0 means the victim is in its left subtree, and 1 means the right.</li>
<li><code>plru_touch()</code> runs on every hit and fill. <code>plru_victim()</code> returns the way to evict and doesn’t change the state.</li>
</ul>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

typedef struct {
    int ways;       /* power of two, 2 to 64 */
    uint64_t bits;  /* node i is bit i */
} plru_t;`,
todo: String.raw`void plru_init(plru_t *p, int ways) {
    /* TODO */
}

void plru_touch(plru_t *p, int way) {
    /* TODO: point every node on the path to the way away from it */
}

int plru_victim(const plru_t *p) {
    /* TODO: follow the bits from the root to a leaf */
    return 0;
}`,
impl: String.raw`void plru_init(plru_t *p, int ways) {
    p->ways = ways;
    p->bits = 0;
}

void plru_touch(plru_t *p, int way) {
    int node = 0;
    for (int half = p->ways / 2; half >= 1; half /= 2) {
        int right = (way & half) != 0;
        if (right) p->bits &= ~(1ull << node);  /* victim side: left */
        else p->bits |= 1ull << node;           /* victim side: right */
        node = 2 * node + 1 + right;
    }
}

int plru_victim(const plru_t *p) {
    int node = 0, way = 0;
    for (int half = p->ways / 2; half >= 1; half /= 2) {
        int right = (p->bits >> node) & 1;
        if (right) way |= half;
        node = 2 * node + 1 + right;
    }
    return way;
}`,
tests: String.raw`static int bitrev(int x, int nbits) {
    int r = 0;
    for (int i = 0; i < nbits; i++) r |= ((x >> i) & 1) << (nbits - 1 - i);
    return r;
}

int main(void) {
    plru_t p;

    /* Filling an empty 8-way set visits the ways in bit-reversed order. */
    int fill8[8] = {0, 4, 2, 6, 1, 5, 3, 7};
    plru_init(&p, 8);
    for (int i = 0; i < 8; i++) {
        int v = plru_victim(&p);
        CHECK(v == fill8[i], "8-way fill %d: victim %d, expected %d", i, v, fill8[i]);
        plru_touch(&p, v);
    }

    /* Touch 0..7 then 0 again: true LRU would evict way 1, tree PLRU evicts 4. */
    plru_init(&p, 8);
    for (int w = 0; w < 8; w++) plru_touch(&p, w);
    CHECK(plru_victim(&p) == 0, "after touching 0..7: victim %d, expected 0", plru_victim(&p));
    plru_touch(&p, 0);
    CHECK(plru_victim(&p) == 4, "after 0..7 then 0: victim %d, expected 4", plru_victim(&p));
    CHECK((p.bits >> 7) == 0, "8-way state uses bits above bit 6");

    /* 16-way and 64-way fills. */
    int sizes[2] = {16, 64}, lg[2] = {4, 6};
    for (int s = 0; s < 2; s++) {
        plru_init(&p, sizes[s]);
        int ok = 1;
        for (int i = 0; i < sizes[s]; i++) {
            int v = plru_victim(&p);
            if (v != bitrev(i, lg[s])) ok = 0;
            plru_touch(&p, v);
        }
        CHECK(ok, "%d-way fill order is wrong", sizes[s]);
    }

    /* Random hits never make the most recently used way the victim, and
       every way gets chosen at some point. */
    srand(7);
    plru_init(&p, 16);
    int seen = 0, mru_victim = 0;
    for (int i = 0; i < 100000; i++) {
        int w = rand() % 16;
        plru_touch(&p, w);
        int v = plru_victim(&p);
        if (v == w) mru_victim++;
        seen |= 1 << v;
    }
    CHECK(mru_victim == 0, "the MRU way was the victim %d times", mru_victim);
    CHECK(seen == 0xFFFF, "some ways are never chosen (mask %x)", seen);

    return REPORT();
}`,
a: `<p>Both functions walk one root-to-leaf path, so each costs log<sub>2</sub>(ways) steps. At each level the next bit of the way number, from the top, picks the side. A touch points every node on the path away from the touched way, so the victim walk can never reach the most recently used way.</p>
<p>Why caches use it: true LRU must store an ordering of the ways, at least ⌈log<sub>2</sub>(ways!)⌉ bits per set (16 bits for 8 ways, 45 for 16), and update several ages on every hit. Tree PLRU needs ways − 1 bits (7 and 15) and changes only the log<sub>2</sub>(ways) bits on one path.</p>
<p>The cost is accuracy. In the second check, touching 0 to 7 and then 0 makes true LRU evict way 1, but the root now points right, so PLRU evicts way 4, which was used more recently than ways 1, 2, and 3. Interviewers often ask for exactly this kind of counterexample.</p>`
});

C("intv-mem", "cache", {
lvl: "hard",
q: `<p>Write a set-associative, write-back, write-allocate cache with true LRU replacement, the core of any cache model. Configure it like Zen 4’s L1D: 32 KB, 8 ways, 64-byte lines. Count hits, misses, and writebacks of dirty victims. <code>cache_flush()</code> writes back every dirty line and returns how many it wrote. Size, ways, and line size are powers of two.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

typedef struct {
    long hits, misses, writebacks;
} stats_t;`,
todo: String.raw`typedef struct {
    stats_t st;
    /* TODO: geometry and per-line state */
} cache_t;

cache_t *cache_new(uint32_t size, int ways, uint32_t line) {
    /* TODO */
    return calloc(1, sizeof(cache_t));
}

/* Returns 1 on a hit. */
int cache_access(cache_t *c, uint64_t addr, int is_write) {
    /* TODO */
    return 0;
}

long cache_flush(cache_t *c) {
    /* TODO */
    return 0;
}`,
impl: String.raw`typedef struct { uint64_t tag; uint32_t lru; uint8_t valid, dirty; } line_t;

typedef struct {
    stats_t st;
    int ways, off_bits;
    uint32_t sets;
    uint32_t clock;     /* LRU timestamp: larger is more recent */
    line_t *lines;      /* sets * ways */
} cache_t;

static int log2u(uint32_t x) { int n = 0; while (x >>= 1) n++; return n; }

cache_t *cache_new(uint32_t size, int ways, uint32_t line) {
    cache_t *c = calloc(1, sizeof *c);
    c->ways = ways;
    c->off_bits = log2u(line);
    c->sets = size / line / ways;
    c->lines = calloc((size_t)c->sets * ways, sizeof(line_t));
    return c;
}

int cache_access(cache_t *c, uint64_t addr, int is_write) {
    uint64_t block = addr >> c->off_bits;
    uint32_t set = block % c->sets;
    uint64_t tag = block / c->sets;
    line_t *s = &c->lines[(size_t)set * c->ways], *victim = &s[0];
    c->clock++;
    for (int w = 0; w < c->ways; w++) {
        if (s[w].valid && s[w].tag == tag) {
            s[w].lru = c->clock;
            s[w].dirty |= is_write;
            c->st.hits++;
            return 1;
        }
        /* Prefer an invalid way, else the least recently used. */
        if (!s[w].valid ? victim->valid : (victim->valid && s[w].lru < victim->lru)) victim = &s[w];
    }
    c->st.misses++;
    if (victim->valid && victim->dirty) c->st.writebacks++;
    *victim = (line_t){ tag, c->clock, 1, (uint8_t)is_write };
    return 0;
}

long cache_flush(cache_t *c) {
    long n = 0;
    for (size_t i = 0; i < (size_t)c->sets * c->ways; i++)
        if (c->lines[i].valid && c->lines[i].dirty) { c->lines[i].dirty = 0; n++; }
    c->st.writebacks += n;
    return n;
}`,
tests: String.raw`#define KB 1024
#define WAY_STRIDE 4096   /* 64 sets * 64 B: addresses this far apart share a set */

int main(void) {
    cache_t *c = cache_new(32 * KB, 8, 64);
    for (int k = 0; k < 8; k++) cache_access(c, (uint64_t)k * WAY_STRIDE, 0);
    CHECK(c->st.misses == 8 && c->st.hits == 0, "filling set 0: %ld misses, expected 8", c->st.misses);
    cache_access(c, 0, 0);              /* line 0 becomes MRU */
    cache_access(c, 8 * WAY_STRIDE, 0); /* evicts line 1, the LRU */
    CHECK(cache_access(c, 0, 0) == 1, "line 0 was touched recently and must survive");
    CHECK(cache_access(c, 1 * WAY_STRIDE, 0) == 0, "line 1 was the LRU and must be gone");
    CHECK(cache_access(c, 64, 0) == 0 && cache_access(c, 64 + 8, 0) == 1, "set 1 is independent, and bytes in one line share it");

    /* Dirty victims are written back, clean ones aren't. */
    cache_t *d = cache_new(32 * KB, 8, 64);
    for (int k = 0; k < 9; k++) cache_access(d, (uint64_t)k * WAY_STRIDE, k % 2 == 0);
    CHECK(d->st.writebacks == 1, "9 writes/reads into one set: %ld writebacks, expected 1 (line 0 was written)", d->st.writebacks);
    cache_access(d, 0, 0);              /* misses, evicts clean line 1 */
    CHECK(d->st.writebacks == 1, "evicting a clean line must not write back");
    cache_access(d, 2 * WAY_STRIDE, 1); /* hit: already dirty */
    long f = cache_flush(d);
    CHECK(f == 4, "flush wrote %ld dirty lines, expected 4 (lines 2, 4, 6, 8)", f);
    CHECK(cache_flush(d) == 0, "a second flush has nothing to write");

    /* Capacity: a 16 KB array fits, a 64 KB array streamed twice misses every time with LRU. */
    cache_t *e = cache_new(32 * KB, 8, 64);
    for (int pass = 0; pass < 2; pass++)
        for (uint64_t a = 0; a < 16 * KB; a += 64) cache_access(e, 0x100000 + a, 0);
    CHECK(e->st.misses == 256 && e->st.hits == 256, "16 KB twice: %ld misses %ld hits, expected 256 and 256", e->st.misses, e->st.hits);
    cache_t *g = cache_new(32 * KB, 8, 64);
    for (int pass = 0; pass < 2; pass++)
        for (uint64_t a = 0; a < 64 * KB; a += 8) cache_access(g, a, 1);
    CHECK(g->st.misses == 2048 && g->st.hits == 14336, "64 KB twice in 8 B steps: %ld misses %ld hits", g->st.misses, g->st.hits);
    CHECK(g->st.writebacks == 1536, "%ld writebacks, expected 1536", g->st.writebacks);
    return REPORT();
}`,
a: `<p>Split the address into offset, set index, and tag: the block number is the address shifted right by log<sub>2</sub>(line), the set is the block number modulo the number of sets (64 here), and the tag is the rest. Keep a timestamp per line for LRU. True LRU over 8 ways is cheap in a model even though hardware approximates it.</p>
<p>On a miss, choose an invalid way first, else the line with the oldest timestamp. If the victim is dirty, count a writeback. Write-allocate means a write miss fills the line and marks it dirty, so stores to a streamed array cost a read and a later writeback per line.</p>
<p>Checks worth reasoning through:</p>
<ul>
<li>Addresses 4 KB apart map to the same set. That is why power-of-two strides of 4 KB thrash a VIPT L1 with only 8 lines per set.</li>
<li>The 64 KB stream is twice the capacity, so with LRU every line is evicted before it is reused: 1,024 misses per pass and 7 hits per line from the other 8-byte words. Every line was written, so 1,536 victims are written back: all 2,048 misses evict a dirty line except the first 512 that filled the empty cache.</li>
</ul>`
});

C("intv-mem", "tlb", {
lvl: "hard",
q: `<p>Translate x86-64 virtual addresses with a 4-level page walk over simulated physical memory, behind a small TLB.</p>
<ul>
<li><code>cr3</code> is the physical address of the top table. Each level uses 9 bits of the address (47–39, 38–30, 29–21, 20–12) to pick an 8-byte entry. Bit 0 of an entry is Present, bit 7 is PS (page size), and bits 51–12 are the next table’s or the page’s physical address.</li>
<li>PS in a level-3 entry maps a 1 GB page, and in a level-2 entry a 2 MB page.</li>
<li>Non-canonical addresses (bits 63–47 not all equal) and non-present entries fault: return 0.</li>
<li><code>walk()</code> also reports how many entries it read. <code>translate()</code> checks a 16-entry fully associative LRU TLB first, where each entry covers its page size, and walks only on a miss.</li>
</ul>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define MEM_BYTES (1 << 20)
static uint8_t mem[MEM_BYTES];     /* simulated physical memory */

static uint64_t rd64(uint64_t pa) { uint64_t v; memcpy(&v, &mem[pa], 8); return v; }

#define P  1ull
#define PS (1ull << 7)
#define ADDR_MASK 0x000FFFFFFFFFF000ull
#define TLB 16`,
todo: String.raw`/* Returns 1 and sets *pa (and *page_bits: 12, 21, or 30) on success, 0 on a fault. */
int walk(uint64_t cr3, uint64_t va, uint64_t *pa, int *page_bits, int *reads) {
    /* TODO */
    return 0;
}

typedef struct {
    /* TODO: 16 entries */
    long walks;
} tlb_t;

void tlb_init(tlb_t *t) {
    /* TODO */
}

int translate(tlb_t *t, uint64_t cr3, uint64_t va, uint64_t *pa) {
    /* TODO */
    return 0;
}`,
impl: String.raw`int walk(uint64_t cr3, uint64_t va, uint64_t *pa, int *page_bits, int *reads) {
    *reads = 0;
    int64_t top = (int64_t)va >> 47;
    if (top != 0 && top != -1) return 0;            /* non-canonical */
    uint64_t table = cr3 & ADDR_MASK;
    for (int level = 4; level >= 1; level--) {
        int shift = 12 + 9 * (level - 1);
        uint64_t pte = rd64(table + ((va >> shift) & 511) * 8);
        (*reads)++;
        if (!(pte & P)) return 0;
        if (level == 1 || ((level == 2 || level == 3) && (pte & PS))) {
            uint64_t mask = (1ull << shift) - 1;
            *pa = ((pte & ADDR_MASK) & ~mask) | (va & mask);
            *page_bits = shift;
            return 1;
        }
        table = pte & ADDR_MASK;
    }
    return 0;
}

typedef struct { uint64_t vpage, ppage; int bits; unsigned lru; int valid; } tlbe_t;

typedef struct {
    tlbe_t e[TLB];
    unsigned clock;
    long walks;
} tlb_t;

void tlb_init(tlb_t *t) { memset(t, 0, sizeof *t); }

int translate(tlb_t *t, uint64_t cr3, uint64_t va, uint64_t *pa) {
    t->clock++;
    tlbe_t *victim = &t->e[0];
    for (int i = 0; i < TLB; i++) {
        tlbe_t *e = &t->e[i];
        if (e->valid && (va >> e->bits) == e->vpage) {
            e->lru = t->clock;
            *pa = (e->ppage << e->bits) | (va & ((1ull << e->bits) - 1));
            return 1;
        }
        if (!e->valid ? victim->valid : (victim->valid && e->lru < victim->lru)) victim = e;
    }
    int bits, reads;
    t->walks++;
    if (!walk(cr3, va, pa, &bits, &reads)) return 0;   /* faults aren't cached */
    *victim = (tlbe_t){ va >> bits, *pa >> bits, bits, t->clock, 1 };
    return 1;
}`,
tests: String.raw`/* Test helpers: a bump allocator of 4 KB table pages, and mappers. */
static uint64_t next_page = 0x1000;
static uint64_t new_table(void) { uint64_t p = next_page; next_page += 4096; memset(&mem[p], 0, 4096); return p; }
static void wr64(uint64_t pa, uint64_t v) { memcpy(&mem[pa], &v, 8); }
static uint64_t entry(uint64_t table, uint64_t va, int level, int make) {
    uint64_t slot = table + ((va >> (12 + 9 * (level - 1))) & 511) * 8, e = rd64(slot);
    if (!(e & P) && make) { e = new_table() | P; wr64(slot, e); }
    return e & ADDR_MASK;
}
static void map(uint64_t cr3, uint64_t va, uint64_t pa, int page_bits) {
    uint64_t t = cr3;
    int leaf = (page_bits - 12) / 9 + 1;
    for (int level = 4; level > leaf; level--) t = entry(t, va, level, 1);
    wr64(t + ((va >> page_bits) & 511) * 8, pa | P | (leaf > 1 ? PS : 0));
}

int main(void) {
    uint64_t cr3 = new_table(), pa;
    int bits, reads;
    map(cr3, 0x00007F0000001000ull, 0x0000000123456000ull, 12);
    map(cr3, 0x0000000040000000ull, 0x0000000080000000ull, 21);   /* 2 MB */
    map(cr3, 0x0000004000000000ull, 0x0000000400000000ull, 30);   /* 1 GB */
    map(cr3, 0xFFFF800000000000ull, 0x0000000000200000ull, 12);   /* kernel half */

    CHECK(walk(cr3, 0x00007F0000001ABCull, &pa, &bits, &reads) && pa == 0x123456ABCull && bits == 12 && reads == 4,
          "4 KB page: pa %llx, %d reads", (unsigned long long)pa, reads);
    CHECK(walk(cr3, 0x00000000401234ABull, &pa, &bits, &reads) && pa == 0x801234ABull && bits == 21 && reads == 3,
          "2 MB page: pa %llx, %d reads", (unsigned long long)pa, reads);
    CHECK(walk(cr3, 0x0000004012345678ull, &pa, &bits, &reads) && pa == 0x412345678ull && bits == 30 && reads == 2,
          "1 GB page: pa %llx, %d reads", (unsigned long long)pa, reads);
    CHECK(walk(cr3, 0xFFFF800000000010ull, &pa, &bits, &reads) && pa == 0x200010ull,
          "kernel address: pa %llx", (unsigned long long)pa);
    CHECK(!walk(cr3, 0x00007F0000002000ull, &pa, &bits, &reads) && reads == 4, "unmapped neighbor page must fault after 4 reads (%d)", reads);
    CHECK(!walk(cr3, 0x0000800000000000ull, &pa, &bits, &reads) && reads == 0, "a non-canonical address faults without reading memory");

    /* TLB reach: 32 4 KB pages cycled through a 16-entry LRU TLB always miss. */
    for (int i = 0; i < 32; i++) map(cr3, 0x10000000ull + 4096ull * i, 0x3000000ull + 4096ull * i, 12);
    tlb_t t;
    tlb_init(&t);
    int ok = 1;
    for (int pass = 0; pass < 2; pass++)
        for (int i = 0; i < 32; i++)
            ok &= translate(&t, cr3, 0x10000000ull + 4096ull * i + 8, &pa) && pa == 0x3000000ull + 4096ull * i + 8;
    CHECK(ok, "translations through the TLB were wrong");
    CHECK(t.walks == 64, "32 pages twice through 16 entries: %ld walks, expected 64", t.walks);

    /* The same 128 KB inside one 2 MB page: one walk. */
    tlb_init(&t);
    for (int pass = 0; pass < 2; pass++)
        for (int i = 0; i < 32; i++) translate(&t, cr3, 0x40000000ull + 4096ull * i, &pa);
    CHECK(t.walks == 1 && pa == 0x80000000ull + 4096ull * 31, "2 MB page: %ld walks, expected 1", t.walks);
    return REPORT();
}`,
a: `<p>The walk is a loop over four levels. At each level, shift the address by 12 + 9 × (level − 1), mask 9 bits, and read that entry. Stop at a non-present entry (fault), at a level-1 entry, or at a level-2 or level-3 entry with PS set. The page offset is then the low 12, 21, or 30 bits of the virtual address. Check canonical form first with an arithmetic shift: bits 63 to 47 must be all zeros or all ones.</p>
<p>A TLB entry stores the virtual page number at its own page size, so a 2 MB entry matches any address whose bits above 21 agree. Hardware keeps separate structures per page size, or probes a unified one several ways. Faults aren’t cached, because the OS will fix the mapping and retry.</p>
<p>The numbers to take away: a 4 KB miss costs 4 dependent memory reads (paging-structure caches usually cut that to one or two), a 2 MB page saves a level, and TLB reach is entries × page size. Cycling through 32 pages with 16 entries and LRU misses every time, while the same 128 KB inside one 2 MB page takes one walk. That is the case for huge pages in large-footprint workloads.</p>`
});

C("intv-coh", "protocol", {
lvl: "hard",
q: `<p>Simulate the MESI protocol on a snooping bus for <code>NCORES</code> private caches, tracking each line’s state per core (no capacity limits). Count bus transactions:</p>
<ul>
<li><strong>Read:</strong> a hit in M, E, or S needs nothing. A miss sends BusRd. If another cache has the line in M, it flushes the data (a flush, which also updates memory) and both end in S. Else, if any other cache has it, the reader gets S from memory. Else the reader gets E from memory.</li>
<li><strong>Write:</strong> in M nothing. In E, upgrade to M silently. In S, send BusUpgr and the others go to I. In I, send BusRdX: a cache holding M flushes, else memory supplies the data, all others go to I, and the writer ends in M.</li>
<li><strong>Evict:</strong> M writes back (count a writeback), and E or S drop silently.</li>
</ul>
<p>Count memory reads (a fill that memory supplies) separately from flushes.</p>`,
head: String.raw`#include <stdio.h>
#include <string.h>

#define NCORES 4
#define NLINES 16

typedef enum { I, S, E, M } state_t;

typedef struct {
    state_t st[NCORES][NLINES];
    long busrd, busrdx, busupgr, flushes, mem_reads, writebacks;
} mesi_t;`,
todo: String.raw`void mesi_read(mesi_t *m, int core, int line) {
    /* TODO */
}

void mesi_write(mesi_t *m, int core, int line) {
    /* TODO */
}

void mesi_evict(mesi_t *m, int core, int line) {
    /* TODO */
}`,
impl: String.raw`void mesi_read(mesi_t *m, int core, int line) {
    if (m->st[core][line] != I) return;
    m->busrd++;
    int others = 0, owner = -1;
    for (int c = 0; c < NCORES; c++) {
        if (c == core || m->st[c][line] == I) continue;
        others++;
        if (m->st[c][line] == M) owner = c;
    }
    if (owner >= 0) m->flushes++; else m->mem_reads++;
    for (int c = 0; c < NCORES; c++)
        if (c != core && m->st[c][line] != I) m->st[c][line] = S;   /* M and E downgrade */
    m->st[core][line] = others ? S : E;
}

void mesi_write(mesi_t *m, int core, int line) {
    state_t s = m->st[core][line];
    if (s == M) return;
    if (s == I) {
        m->busrdx++;
        int owner = 0;
        for (int c = 0; c < NCORES; c++) if (c != core && m->st[c][line] == M) owner = 1;
        if (owner) m->flushes++; else m->mem_reads++;
    } else if (s == S) {
        m->busupgr++;
    }   /* E: silent upgrade */
    for (int c = 0; c < NCORES; c++) if (c != core) m->st[c][line] = I;
    m->st[core][line] = M;
}

void mesi_evict(mesi_t *m, int core, int line) {
    if (m->st[core][line] == M) m->writebacks++;
    m->st[core][line] = I;
}`,
tests: String.raw`static const char *N = "ISEM";

int main(void) {
    mesi_t m;
    memset(&m, 0, sizeof m);

    mesi_read(&m, 0, 0);
    CHECK(m.st[0][0] == E && m.mem_reads == 1, "first reader gets E (got %c)", N[m.st[0][0]]);
    mesi_write(&m, 0, 0);
    CHECK(m.st[0][0] == M && m.busupgr == 0 && m.busrdx == 0, "E to M is silent");
    mesi_read(&m, 1, 0);
    CHECK(m.st[0][0] == S && m.st[1][0] == S && m.flushes == 1, "read of an M line: both S, one flush (%c %c)", N[m.st[0][0]], N[m.st[1][0]]);
    mesi_read(&m, 2, 0);
    CHECK(m.st[2][0] == S && m.mem_reads == 2 && m.flushes == 1, "third reader gets S from memory");
    mesi_write(&m, 1, 0);
    CHECK(m.busupgr == 1 && m.st[1][0] == M && m.st[0][0] == I && m.st[2][0] == I, "S to M sends BusUpgr and invalidates the others");
    mesi_write(&m, 3, 0);
    CHECK(m.busrdx == 1 && m.flushes == 2 && m.st[3][0] == M && m.st[1][0] == I, "BusRdX takes the line from the M owner");
    mesi_evict(&m, 3, 0);
    CHECK(m.writebacks == 1 && m.st[3][0] == I, "evicting M writes back");
    mesi_read(&m, 0, 0);
    CHECK(m.st[0][0] == E && m.mem_reads == 3, "after the writeback, a reader gets E from memory");
    mesi_evict(&m, 0, 0);
    CHECK(m.writebacks == 1, "evicting E is silent");

    /* False sharing: cores 0 and 1 alternately increment counters in one line. */
    memset(&m, 0, sizeof m);
    for (int i = 0; i < 1000; i++) { mesi_read(&m, i & 1, 5); mesi_write(&m, i & 1, 5); }
    CHECK(m.busrd == 1000 && m.busupgr == 999 && m.flushes == 999,
          "ping-pong: %ld BusRd %ld BusUpgr %ld flushes, expected 1000, 999, 999", m.busrd, m.busupgr, m.flushes);
    /* Padding the counters into separate lines removes all of it. */
    memset(&m, 0, sizeof m);
    for (int i = 0; i < 1000; i++) { mesi_read(&m, i & 1, 6 + (i & 1)); mesi_write(&m, i & 1, 6 + (i & 1)); }
    CHECK(m.busrd == 2 && m.busupgr == 0 && m.busrdx == 0, "padded: %ld BusRd, expected 2 and no upgrades", m.busrd);
    return REPORT();
}`,
a: `<p>Every case is a read of the other caches’ states followed by an update. Two details are easy to miss: a reader must downgrade an E holder to S as well as an M holder, and a write in E needs no bus transaction at all. That silent upgrade is the reason E exists: private data that is read and then written costs one bus transaction instead of two.</p>
<p>The ping-pong check is the classic false-sharing cost. Each core reads its counter (a miss, because the other core holds the line in M, so the owner flushes) and then writes it (an upgrade, because the line is now shared). That is two bus transactions per increment, about 1,000 BusRd and 999 BusUpgr for 1,000 increments, against two compulsory misses once the counters sit in separate lines. On a real chip each of those transfers costs tens of nanoseconds across the cores, which is why padding to 64 bytes can speed such code up by an order of magnitude.</p>
<p>A read-for-ownership optimization would let a core that reads and then writes send one BusRdX, and MOESI’s O state lets the dirty owner keep supplying data without writing memory. Both change these counts, so state which protocol a model assumes.</p>`
});

C("intv-coh", "scale", {
lvl: "hard",
q: `<p>Count coherence messages at a home directory for 64 cores, with either a full sharer bit-vector or a limited-pointer directory. Each line is Uncached, Shared (a set of sharers), or Modified (one owner). Message counts per request:</p>
<ul>
<li><strong>Read miss:</strong> Uncached or Shared: request + data = 2, and the reader joins the sharers. Modified by another core: request, forward to the owner, data to the reader, and the owner’s writeback to home = 4, and both become sharers.</li>
<li><strong>Write miss or upgrade:</strong> Uncached: 2. Shared: request + grant = 2, plus an invalidation and an acknowledgment for each core the directory must invalidate. Modified by another core: 4. The writer becomes the owner.</li>
<li><strong>Hits</strong> (a read by a sharer or owner, a write by the owner) send nothing.</li>
<li><strong>Evictions:</strong> a Modified owner writes back (1 message, line becomes Uncached). Shared evictions are silent, so the directory may keep stale sharers and still invalidate them.</li>
</ul>
<p>With <code>ptrs</code> &gt; 0, the directory stores at most <code>ptrs</code> sharer IDs. When a line gains more sharers than that, it is marked overflowed, and invalidating it must go to every core except the writer.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define CORES 64
#define LINES 16

typedef enum { UNCACHED, SHARED, MODIFIED } dstate_t;`,
todo: String.raw`typedef struct {
    int ptrs;      /* 0 = full bit-vector */
    long msgs;
    /* TODO: per-line directory state */
} dir_t;

void dir_init(dir_t *d, int ptrs) {
    memset(d, 0, sizeof *d);
    d->ptrs = ptrs;
}

void dir_read(dir_t *d, int core, int line) {
    /* TODO */
}

void dir_write(dir_t *d, int core, int line) {
    /* TODO */
}

void dir_evict(dir_t *d, int core, int line) {
    /* TODO */
}`,
impl: String.raw`typedef struct {
    dstate_t st;
    uint64_t sharers;   /* exact set, kept to know who really holds the line */
    int owner, overflow;
} dline_t;

typedef struct {
    int ptrs;      /* 0 = full bit-vector */
    long msgs;
    dline_t l[LINES];
} dir_t;

void dir_init(dir_t *d, int ptrs) {
    memset(d, 0, sizeof *d);
    d->ptrs = ptrs;
}

static void add_sharer(dir_t *d, dline_t *x, int core) {
    x->sharers |= 1ull << core;
    if (d->ptrs && __builtin_popcountll(x->sharers) > d->ptrs) x->overflow = 1;
}

void dir_read(dir_t *d, int core, int line) {
    dline_t *x = &d->l[line];
    if (x->st == MODIFIED) {
        if (x->owner == core) return;
        d->msgs += 4;
        x->st = SHARED;
        x->sharers = 0; x->overflow = 0;
        add_sharer(d, x, x->owner);
    } else {
        if (x->st == SHARED && (x->sharers >> core & 1)) return;
        d->msgs += 2;
        if (x->st == UNCACHED) { x->sharers = 0; x->overflow = 0; }
        x->st = SHARED;
    }
    add_sharer(d, x, core);
}

void dir_write(dir_t *d, int core, int line) {
    dline_t *x = &d->l[line];
    if (x->st == MODIFIED) {
        if (x->owner == core) return;
        d->msgs += 4;
    } else if (x->st == SHARED) {
        int targets = x->overflow ? CORES - 1
                                  : __builtin_popcountll(x->sharers & ~(1ull << core));
        d->msgs += 2 + 2 * targets;
    } else {
        d->msgs += 2;
    }
    x->st = MODIFIED;
    x->owner = core;
    x->sharers = 0; x->overflow = 0;
}

void dir_evict(dir_t *d, int core, int line) {
    dline_t *x = &d->l[line];
    if (x->st == MODIFIED && x->owner == core) { d->msgs += 1; x->st = UNCACHED; }
    /* Shared evictions are silent: the sharer stays recorded. */
}`,
tests: String.raw`int main(void) {
    dir_t d;
    dir_init(&d, 0);
    dir_read(&d, 0, 0);
    CHECK(d.msgs == 2, "read of an uncached line: %ld messages, expected 2", d.msgs);
    dir_read(&d, 0, 0);
    CHECK(d.msgs == 2, "a hit sends nothing");
    dir_write(&d, 0, 0);
    CHECK(d.msgs == 4, "upgrade by the only sharer: %ld, expected 4", d.msgs);
    dir_read(&d, 5, 0);
    CHECK(d.msgs == 8, "read of a modified line: %ld, expected 8", d.msgs);
    dir_write(&d, 9, 0);
    CHECK(d.msgs == 14, "write to a line shared by 0 and 5: %ld, expected 14", d.msgs);
    dir_evict(&d, 9, 0);
    CHECK(d.msgs == 15, "owner eviction writes back: %ld, expected 15", d.msgs);

    /* 8 readers, then a write by a ninth core. */
    long full, lim;
    dir_init(&d, 0);
    for (int c = 0; c < 8; c++) dir_read(&d, c, 1);
    dir_write(&d, 63, 1);
    full = d.msgs;
    dir_init(&d, 4);
    for (int c = 0; c < 8; c++) dir_read(&d, c, 1);
    dir_write(&d, 63, 1);
    lim = d.msgs;
    CHECK(full == 16 + 18, "full map, 8 sharers: %ld messages, expected 34", full);
    CHECK(lim == 16 + 2 + 2 * 63, "4 pointers, overflowed: %ld messages, expected 144", lim);

    /* 3 sharers fit in 4 pointers: no broadcast. */
    dir_init(&d, 4);
    for (int c = 0; c < 3; c++) dir_read(&d, c, 2);
    dir_write(&d, 7, 2);
    CHECK(d.msgs == 6 + 2 + 6, "4 pointers, 3 sharers: %ld, expected 14", d.msgs);

    /* Silent evictions leave stale sharers that still get invalidations. */
    dir_init(&d, 0);
    dir_read(&d, 1, 3); dir_read(&d, 2, 3);
    dir_evict(&d, 1, 3);
    dir_write(&d, 2, 3);
    CHECK(d.msgs == 4 + 4, "stale sharer still invalidated: %ld, expected 8", d.msgs);
    return REPORT();
}`,
a: `<p>Keep the exact sharer set per line even in limited-pointer mode, and add an overflow flag that is set when the set grows beyond the pointer count. The flag decides how many invalidations a write sends: the exact other sharers for a full map or a line that never overflowed, and every other core once it has.</p>
<p>The comparison is the point: with 8 readers, a full map sends 7 invalidations and 7 acknowledgments, while a 4-pointer directory that overflowed must broadcast to 63 cores, for 144 messages instead of 34. A full bit-vector costs 64 bits per line, though, which at 64 cores is as large as the 64-byte line it tracks if the directory covered all of memory. That is why real designs use limited pointers, coarse vectors (one bit per cluster), or sparse directories that only track lines actually cached.</p>
<p>Silent Shared evictions save a message per eviction but leave stale sharers, so a later write still invalidates them and waits for their acknowledgments. Some protocols send a clean-eviction notice to keep the directory precise. Which choice wins depends on how often evicted lines are written later.</p>`
});

C("intv-conc", "locks", {
lvl: "medium",
threads: true,
q: `<p>Write a test-and-test-and-set spinlock with exponential backoff, using C11 atomics with the weakest correct memory orders. Spin on a plain load while the lock is held, try an atomic exchange when it looks free, and back off for a doubling number of <code>cpu_relax()</code> calls (capped at 64) each time the exchange loses.</p>`,
head: String.raw`#include <stdio.h>
#include <pthread.h>
#include <stdatomic.h>
#include <sched.h>

/* On real hardware this would be a pause or yield instruction. */
static inline void cpu_relax(void) { sched_yield(); }`,
todo: String.raw`typedef struct { atomic_int locked; } spinlock_t;

void spin_lock(spinlock_t *l) {
    /* TODO */
}

void spin_unlock(spinlock_t *l) {
    /* TODO */
}`,
impl: String.raw`typedef struct { atomic_int locked; } spinlock_t;

void spin_lock(spinlock_t *l) {
    int delay = 1;
    for (;;) {
        /* Wait in our own cache: a relaxed load takes no ownership. */
        while (atomic_load_explicit(&l->locked, memory_order_relaxed))
            cpu_relax();
        if (!atomic_exchange_explicit(&l->locked, 1, memory_order_acquire))
            return;
        for (int i = 0; i < delay; i++) cpu_relax();   /* lost the race */
        if (delay < 64) delay *= 2;
    }
}

void spin_unlock(spinlock_t *l) {
    atomic_store_explicit(&l->locked, 0, memory_order_release);
}`,
tests: String.raw`#define THREADS 4
#define ITERS 400

static spinlock_t lock;
static long counter;          /* plain: only the lock protects it */
static int inside, overlap;

static void *worker(void *arg) {
    (void)arg;
    for (int i = 0; i < ITERS; i++) {
        spin_lock(&lock);
        if (++inside != 1) overlap++;
        long v = counter;
        sched_yield();          /* invite another thread in */
        counter = v + 1;
        inside--;
        spin_unlock(&lock);
    }
    return NULL;
}

int main(void) {
    pthread_t t[THREADS];
    for (int i = 0; i < THREADS; i++) pthread_create(&t[i], NULL, worker, NULL);
    for (int i = 0; i < THREADS; i++) pthread_join(t[i], NULL);
    CHECK(overlap == 0, "two threads were inside the critical section %d times", overlap);
    CHECK(counter == THREADS * ITERS, "counter is %ld, expected %d", counter, THREADS * ITERS);
    CHECK(atomic_load(&lock.locked) == 0, "the lock should end up free");
    return REPORT();
}`,
a: `<p>The structure is three loops: spin on a relaxed load until the lock looks free, try one exchange with acquire order, and if another core won, back off before spinning again. Acquire on the successful exchange and release on the unlocking store are exactly what a lock needs: nothing in the critical section moves above the acquire or below the release. The waiting loads can be relaxed because they only decide when to try. They don’t protect any data.</p>
<p>Backoff reduces the burst of exchanges after each release, when every spinner sees the lock free at once. Capping it keeps a thread from sleeping long after the lock is free. Real implementations add randomness so the backoffs of different threads don’t stay in step.</p>
<p>On this page’s simulator, the yield inside the critical section forces other threads to run there, so a lock that doesn’t exclude shows up as overlap and lost increments. Ordering bugs (for example relaxed instead of acquire) don’t show up here, because the simulator is sequentially consistent, so check those by reasoning.</p>`
});

C("intv-conc", "locks", {
lvl: "medium",
threads: true,
q: `<p>Write a ticket lock. <code>ticket_lock()</code> takes the next ticket, waits until it is being served, and returns the ticket it held. <code>ticket_unlock()</code> serves the next ticket. The checks verify mutual exclusion and that the lock is granted in ticket order.</p>`,
head: String.raw`#include <stdio.h>
#include <pthread.h>
#include <stdatomic.h>
#include <sched.h>

static inline void cpu_relax(void) { sched_yield(); }

typedef struct { atomic_uint next, serving; } ticket_lock_t;`,
todo: String.raw`unsigned ticket_lock(ticket_lock_t *l) {
    /* TODO */
    return 0;
}

void ticket_unlock(ticket_lock_t *l) {
    /* TODO */
}`,
impl: String.raw`unsigned ticket_lock(ticket_lock_t *l) {
    unsigned me = atomic_fetch_add_explicit(&l->next, 1, memory_order_relaxed);
    while (atomic_load_explicit(&l->serving, memory_order_acquire) != me)
        cpu_relax();   /* could back off by (me - serving) critical sections */
    return me;
}

void ticket_unlock(ticket_lock_t *l) {
    /* Only the holder writes serving, so a load and a store suffice. */
    unsigned s = atomic_load_explicit(&l->serving, memory_order_relaxed);
    atomic_store_explicit(&l->serving, s + 1, memory_order_release);
}`,
tests: String.raw`#define THREADS 5
#define ITERS 200

static ticket_lock_t lock;
static long counter;
static int inside, overlap;
static unsigned order[THREADS * ITERS];
static int granted;

static void *worker(void *arg) {
    (void)arg;
    for (int i = 0; i < ITERS; i++) {
        unsigned t = ticket_lock(&lock);
        if (++inside != 1) overlap++;
        order[granted++] = t;
        long v = counter;
        sched_yield();
        counter = v + 1;
        inside--;
        ticket_unlock(&lock);
    }
    return NULL;
}

int main(void) {
    pthread_t t[THREADS];
    for (int i = 0; i < THREADS; i++) pthread_create(&t[i], NULL, worker, NULL);
    for (int i = 0; i < THREADS; i++) pthread_join(t[i], NULL);
    CHECK(overlap == 0, "two threads were inside the critical section %d times", overlap);
    CHECK(counter == THREADS * ITERS, "counter is %ld, expected %d", counter, THREADS * ITERS);
    int fifo = 1;
    for (int k = 0; k < granted; k++) if (order[k] != (unsigned)k) fifo = 0;
    CHECK(fifo && granted == THREADS * ITERS, "the lock must be granted in ticket order 0, 1, 2, ...");
    return REPORT();
}`,
a: `<p>Taking a ticket is one <code>fetch_add</code>, which needs no ordering of its own because it protects nothing. Waiting is an acquire load of <code>serving</code>. Releasing doesn’t need an atomic increment: only the holder ever writes <code>serving</code>, so a relaxed load and a release store are enough.</p>
<p>The lock is FIFO by construction, which TTAS isn’t: under TTAS a thread can lose every race indefinitely. The price is that a waiter can’t barge in when the next ticket holder is slow to notice, for example when its thread was descheduled, which makes ticket locks behave badly when there are more threads than cores. Unsigned wraparound is harmless, since only equality is compared.</p>
<p>The scaling problem is that every waiter spins on <code>serving</code>, so each release causes a miss in every waiting core. The Math tab’s first question puts numbers on it.</p>`
});

C("intv-conc", "locks", {
lvl: "hard",
threads: true,
q: `<p>Write the MCS queue lock (Mellor-Crummey and Scott, 1991). Each thread brings its own queue node. Acquire appends the node to the tail with one atomic exchange and, if there was a predecessor, links itself in and spins on a flag in its own node. Release hands the lock to the successor by clearing the successor’s flag. Handle the race where a successor has swapped itself into the tail but hasn’t linked itself to your node yet.</p>`,
head: String.raw`#include <stdio.h>
#include <stddef.h>
#include <pthread.h>
#include <stdatomic.h>
#include <sched.h>

static inline void cpu_relax(void) { sched_yield(); }

typedef struct mcs_node {
    _Atomic(struct mcs_node *) next;
    atomic_int wait;
} mcs_node_t;

typedef struct { _Atomic(mcs_node_t *) tail; } mcs_lock_t;`,
todo: String.raw`void mcs_acquire(mcs_lock_t *l, mcs_node_t *me) {
    /* TODO */
}

void mcs_release(mcs_lock_t *l, mcs_node_t *me) {
    /* TODO */
}`,
impl: String.raw`void mcs_acquire(mcs_lock_t *l, mcs_node_t *me) {
    atomic_store_explicit(&me->next, NULL, memory_order_relaxed);
    atomic_store_explicit(&me->wait, 1, memory_order_relaxed);
    mcs_node_t *prev = atomic_exchange_explicit(&l->tail, me, memory_order_acq_rel);
    if (!prev) return;                                  /* the lock was free */
    atomic_store_explicit(&prev->next, me, memory_order_release);
    while (atomic_load_explicit(&me->wait, memory_order_acquire))
        cpu_relax();                                    /* spin on our own node */
}

void mcs_release(mcs_lock_t *l, mcs_node_t *me) {
    mcs_node_t *succ = atomic_load_explicit(&me->next, memory_order_acquire);
    if (!succ) {
        mcs_node_t *expect = me;
        /* No successor yet: if we're still the tail, the lock becomes free. */
        if (atomic_compare_exchange_strong_explicit(&l->tail, &expect, NULL,
                memory_order_acq_rel, memory_order_acquire))
            return;
        /* Someone swapped into the tail but hasn't linked to us yet. */
        while (!(succ = atomic_load_explicit(&me->next, memory_order_acquire)))
            cpu_relax();
    }
    atomic_store_explicit(&succ->wait, 0, memory_order_release);
}`,
tests: String.raw`#define THREADS 6
#define ITERS 250

static mcs_lock_t lock;
static long counter;
static int inside, overlap;

static void *worker(void *arg) {
    (void)arg;
    for (int i = 0; i < ITERS; i++) {
        mcs_node_t node;              /* a fresh node per acquisition */
        mcs_acquire(&lock, &node);
        if (++inside != 1) overlap++;
        long v = counter;
        sched_yield();
        counter = v + 1;
        inside--;
        mcs_release(&lock, &node);
    }
    return NULL;
}

int main(void) {
    pthread_t t[THREADS];
    for (int i = 0; i < THREADS; i++) pthread_create(&t[i], NULL, worker, NULL);
    for (int i = 0; i < THREADS; i++) pthread_join(t[i], NULL);
    CHECK(overlap == 0, "two threads were inside the critical section %d times", overlap);
    CHECK(counter == THREADS * ITERS, "counter is %ld, expected %d", counter, THREADS * ITERS);
    CHECK(atomic_load(&lock.tail) == NULL, "the queue should be empty at the end");
    return REPORT();
}`,
a: `<p>The tail pointer is the only shared word that waiters write, and each waiter writes it once, with the exchange that enqueues it. After that, a waiter spins on its own node, so a release invalidates one cache line in one other core instead of all of them. That is what makes MCS scale: O(1) coherence traffic per handoff, and FIFO order for free.</p>
<p>The subtle part is release when <code>next</code> is still NULL. Either nobody is waiting, and a CAS of the tail from <code>me</code> back to NULL frees the lock, or a new waiter has already swapped itself into the tail but hasn’t stored the link yet. Then the CAS fails, and the releaser must wait for the link to appear before handing over. Skipping that wait, or freeing the node too early, is the classic MCS bug.</p>
<p>Orders: the exchange is acq_rel because it both acquires (when the lock was free) and publishes the initialized node. The link store and the flag store are releases, paired with the acquire loads that read them.</p>`
});

C("intv-conc", "barriers", {
lvl: "hard",
threads: true,
q: `<p>Write a reusable centralized barrier with sense reversal. Each thread keeps its own <code>local_sense</code>, starting at 0. The checks run many back-to-back episodes, so a barrier that only works once, or that lets a fast thread run into the next episode early, fails.</p>`,
head: String.raw`#include <stdio.h>
#include <pthread.h>
#include <stdatomic.h>
#include <sched.h>

static inline void cpu_relax(void) { sched_yield(); }

typedef struct {
    atomic_int count, sense;
    int n;
} barrier_t;`,
todo: String.raw`void barrier_init(barrier_t *b, int n) {
    /* TODO */
}

void barrier_wait(barrier_t *b, int *local_sense) {
    /* TODO */
}`,
impl: String.raw`void barrier_init(barrier_t *b, int n) {
    b->n = n;
    atomic_init(&b->count, n);
    atomic_init(&b->sense, 0);
}

void barrier_wait(barrier_t *b, int *local_sense) {
    *local_sense = !*local_sense;
    if (atomic_fetch_sub_explicit(&b->count, 1, memory_order_acq_rel) == 1) {
        /* Last to arrive: reset for the next episode, then release. */
        atomic_store_explicit(&b->count, b->n, memory_order_relaxed);
        atomic_store_explicit(&b->sense, *local_sense, memory_order_release);
    } else {
        while (atomic_load_explicit(&b->sense, memory_order_acquire) != *local_sense)
            cpu_relax();
    }
}`,
tests: String.raw`#define THREADS 5
#define PHASES 60

static barrier_t bar;
static int slot[THREADS];
static int bad;

static void *worker(void *arg) {
    int id = (int)(long)arg, sense = 0;
    for (int p = 1; p <= PHASES; p++) {
        slot[id] = p;
        barrier_wait(&bar, &sense);
        /* Everyone has reached phase p, and nobody is past p + 1. */
        for (int u = 0; u < THREADS; u++)
            if (slot[u] < p || slot[u] > p + 1) bad++;
    }
    return NULL;
}

int main(void) {
    barrier_init(&bar, THREADS);
    pthread_t t[THREADS];
    for (long i = 0; i < THREADS; i++) pthread_create(&t[i], NULL, worker, (void *)i);
    for (int i = 0; i < THREADS; i++) pthread_join(t[i], NULL);
    CHECK(bad == 0, "%d times a thread saw another thread outside its phase", bad);
    int done = 1;
    for (int u = 0; u < THREADS; u++) done &= slot[u] == PHASES;
    CHECK(done, "every thread should finish all %d phases", PHASES);
    CHECK(atomic_load(&bar.count) == THREADS, "the count should be reset after the last episode");
    return REPORT();
}`,
a: `<p>Each episode, every thread flips its private sense. The last arriver (the one whose decrement takes the count from 1 to 0) resets the count first and then publishes its new sense with a release store. Everyone else spins until the shared sense equals their own. Because the shared sense alternates, a thread still leaving episode <em>p</em> and a thread already arriving at episode <em>p</em> + 1 compare against different values, so neither can be confused. And the count is reset before the release, when no other thread can touch it.</p>
<p>The decrement is acq_rel so that the last arriver sees all the other threads’ writes from before the barrier, and the release store hands those on to every waiter. This is the barrier from the <a href="#/barrier">Sense-Reversing Barriers</a> page, and its cost is 64 serialized updates on one line at 64 threads, which the combining tree below fixes.</p>`
});

C("intv-conc", "barriers", {
lvl: "hard",
threads: true,
q: `<p>Write a software combining tree barrier. Threads are grouped <code>k</code> to a leaf node (thread <code>id</code> uses leaf <code>id / k</code>), leaves are grouped <code>k</code> to a parent, and so on up to one root. Each node counts arrivals. The last thread to arrive at a node continues to its parent, and the last to arrive at the root releases everyone through one global sense flag. Every other thread waits on that flag. Groups at the end of a level may be smaller than <code>k</code>, and the barrier must be reusable. Support up to 64 threads.</p>`,
head: String.raw`#include <stdio.h>
#include <pthread.h>
#include <stdatomic.h>
#include <sched.h>

static inline void cpu_relax(void) { sched_yield(); }
#define MAXT 64`,
todo: String.raw`typedef struct {
    atomic_int sense;
    /* TODO: tree nodes, and each thread's leaf */
} tree_barrier_t;

void tb_init(tree_barrier_t *b, int n, int k) {
    /* TODO */
}

void tb_wait(tree_barrier_t *b, int id, int *local_sense) {
    /* TODO */
}`,
impl: String.raw`typedef struct tnode {
    atomic_int count;
    int expect;               /* arrivals this node waits for */
    struct tnode *parent;
} tnode_t;

typedef struct {
    atomic_int sense;
    tnode_t nodes[2 * MAXT];
    tnode_t *leaf[MAXT];
} tree_barrier_t;

void tb_init(tree_barrier_t *b, int n, int k) {
    atomic_init(&b->sense, 0);
    int used = 0, below = n, prev_cnt = 0;
    tnode_t *prev = NULL;
    for (;;) {
        int cnt = (below + k - 1) / k;          /* nodes on this level */
        tnode_t *lv = &b->nodes[used];
        used += cnt;
        for (int i = 0; i < cnt; i++) {
            lv[i].expect = i == cnt - 1 ? below - i * k : k;
            atomic_init(&lv[i].count, lv[i].expect);
            lv[i].parent = NULL;
        }
        if (!prev) for (int t = 0; t < n; t++) b->leaf[t] = &lv[t / k];
        else for (int j = 0; j < prev_cnt; j++) prev[j].parent = &lv[j / k];
        if (cnt == 1) break;
        prev = lv; prev_cnt = cnt; below = cnt;
    }
}

void tb_wait(tree_barrier_t *b, int id, int *local_sense) {
    *local_sense = !*local_sense;
    tnode_t *nd = b->leaf[id];
    /* Climb while we're the last to arrive. Reset each node on the way:
       nobody can arrive there again until we release. */
    while (nd && atomic_fetch_sub_explicit(&nd->count, 1, memory_order_acq_rel) == 1) {
        atomic_store_explicit(&nd->count, nd->expect, memory_order_relaxed);
        nd = nd->parent;
    }
    if (!nd) {                                   /* last at the root */
        atomic_store_explicit(&b->sense, *local_sense, memory_order_release);
        return;
    }
    while (atomic_load_explicit(&b->sense, memory_order_acquire) != *local_sense)
        cpu_relax();
}`,
tests: String.raw`#define PHASES 30

static tree_barrier_t tb;
static int nthreads, slot[MAXT], bad;

static void *worker(void *arg) {
    int id = (int)(long)arg, sense = 0;
    for (int p = 1; p <= PHASES; p++) {
        slot[id] = p;
        tb_wait(&tb, id, &sense);
        for (int u = 0; u < nthreads; u++)
            if (slot[u] < p || slot[u] > p + 1) bad++;
    }
    return NULL;
}

static void run(int n, int k) {
    nthreads = n; bad = 0;
    for (int u = 0; u < n; u++) slot[u] = 0;
    tb_init(&tb, n, k);
    pthread_t t[MAXT];
    for (long i = 0; i < n; i++) pthread_create(&t[i], NULL, worker, (void *)i);
    for (int i = 0; i < n; i++) pthread_join(t[i], NULL);
    int done = 1;
    for (int u = 0; u < n; u++) done &= slot[u] == PHASES;
    CHECK(bad == 0 && done, "%d threads, fan-in %d: %d phase violations", n, k, bad);
}

int main(void) {
    run(9, 3);    /* two full levels */
    run(7, 2);    /* uneven groups, three levels */
    run(10, 4);   /* last leaf has 2 threads */
    run(5, 8);    /* a single node */
    run(1, 4);    /* one thread */
    return REPORT();
}`,
a: `<p>Build the tree bottom-up: a level of ⌈below / <em>k</em>⌉ nodes, each expecting <em>k</em> arrivals except the last, which takes the remainder. Thread <code>id</code> starts at leaf <code>id / k</code>, and node <em>j</em> of a level reports to node <em>j</em> / <em>k</em> of the next. Stop at a level with one node, the root.</p>
<p>The arrival climbs: a thread decrements its node, and only the thread that brings it to zero continues upward, so each node sees at most <em>k</em> contending updates and different subtrees proceed in parallel. That thread also resets the node’s count on the way, which is safe because no thread can arrive at that node again until the release. The thread that empties the root flips the global sense, and everyone else waits for it, using the same sense reversal as the centralized barrier.</p>
<p>Arrival costs about <em>k</em> × log<sub><em>k</em></sub>(<em>P</em>) serialized updates instead of <em>P</em>. A tree wake-up (each winner releasing its own subtree on the way back down) would also remove the single hot flag, at the cost of log<sub><em>k</em></sub>(<em>P</em>) steps of latency.</p>`
});

C("intv-conc", "lockfree", {
lvl: "hard",
threads: true,
q: `<p>Write a lock-free single-producer, single-consumer ring buffer of <code>CAP</code> integers. <code>head</code> and <code>tail</code> are free-running counters (they count every push and pop and wrap only at 2<sup>32</sup>), and the slot index is the counter modulo <code>CAP</code>. <code>ring_push()</code> returns 0 when full and <code>ring_pop()</code> returns 0 when empty. Use acquire and release where they are needed and relaxed everywhere else, and no read-modify-write atomics.</p>`,
head: String.raw`#include <stdio.h>
#include <limits.h>
#include <pthread.h>
#include <stdatomic.h>
#include <sched.h>

#define CAP 8   /* a power of two */

typedef struct {
    int buf[CAP];
    atomic_uint head;   /* next slot to read, written only by the consumer */
    atomic_uint tail;   /* next slot to write, written only by the producer */
} ring_t;`,
todo: String.raw`int ring_push(ring_t *r, int v) {
    /* TODO */
    return 0;
}

int ring_pop(ring_t *r, int *v) {
    /* TODO */
    return 0;
}`,
impl: String.raw`int ring_push(ring_t *r, int v) {
    unsigned t = atomic_load_explicit(&r->tail, memory_order_relaxed);   /* our own */
    unsigned h = atomic_load_explicit(&r->head, memory_order_acquire);
    if (t - h == CAP) return 0;                  /* full; works across wraparound */
    r->buf[t % CAP] = v;
    atomic_store_explicit(&r->tail, t + 1, memory_order_release);        /* publish */
    return 1;
}

int ring_pop(ring_t *r, int *v) {
    unsigned h = atomic_load_explicit(&r->head, memory_order_relaxed);
    unsigned t = atomic_load_explicit(&r->tail, memory_order_acquire);
    if (h == t) return 0;
    *v = r->buf[h % CAP];
    atomic_store_explicit(&r->head, h + 1, memory_order_release);        /* free the slot */
    return 1;
}`,
tests: String.raw`#define N 3000

static ring_t ring;
static int got[N], received, stuck;

static void *producer(void *arg) {
    (void)arg;
    for (int i = 0; i < N; i++) {
        long tries = 0;
        while (!ring_push(&ring, i)) { sched_yield(); if (++tries > 100000) { stuck = 1; return NULL; } }
    }
    return NULL;
}

static void *consumer(void *arg) {
    (void)arg;
    while (received < N) {
        long tries = 0;
        int v;
        while (!ring_pop(&ring, &v)) { sched_yield(); if (++tries > 100000) { stuck = 1; return NULL; } }
        got[received++] = v;
    }
    return NULL;
}

int main(void) {
    /* One thread: full, empty, order, and counters that wrap past 2^32. */
    ring_t r = {0};
    atomic_store(&r.head, UINT_MAX - 3);
    atomic_store(&r.tail, UINT_MAX - 3);
    int ok = 1, v;
    for (int i = 0; i < CAP; i++) ok &= ring_push(&r, 100 + i);
    CHECK(ok, "the first %d pushes must succeed", CAP);
    CHECK(!ring_push(&r, 999), "a push into a full ring must fail");
    for (int i = 0; i < CAP; i++) ok &= ring_pop(&r, &v) && v == 100 + i;
    CHECK(ok, "pops must return the values in order across the wraparound");
    CHECK(!ring_pop(&r, &v), "a pop from an empty ring must fail");

    /* Two threads. */
    pthread_t p, c;
    pthread_create(&c, NULL, consumer, NULL);
    pthread_create(&p, NULL, producer, NULL);
    pthread_join(p, NULL);
    pthread_join(c, NULL);
    CHECK(!stuck, "a thread gave up waiting");
    int inorder = received == N;
    for (int i = 0; i < received; i++) if (got[i] != i) inorder = 0;
    CHECK(inorder, "received %d values, expected 0..%d in order", received, N - 1);
    return REPORT();
}`,
a: `<p>Each index has one writer, so plain stores of the new value are enough. The memory orders carry the data:</p>
<ul>
<li>The producer writes the slot, then <strong>release</strong>-stores the tail. The consumer <strong>acquire</strong>-loads the tail before reading the slot. So the consumer never reads a slot before its data is visible.</li>
<li>The consumer reads the slot, then <strong>release</strong>-stores the head. The producer <strong>acquire</strong>-loads the head before overwriting the slot. So the producer never overwrites data the consumer hasn’t read yet.</li>
<li>Each side reads its own index relaxed, since only it writes that index.</li>
</ul>
<p>Free-running unsigned counters make full and empty unambiguous: empty is <code>head == tail</code> and full is <code>tail − head == CAP</code>, both correct across wraparound because unsigned subtraction is modulo 2<sup>32</sup>. That needs <code>CAP</code> to divide 2<sup>32</sup>, hence a power of two.</p>
<p>For performance, put <code>head</code> and <code>tail</code> on separate cache lines, and have each side keep a private copy of the other’s index, rereading it only when the ring looks full or empty. That removes most of the coherence misses per message.</p>`
});

C("intv-conc", "lockfree", {
lvl: "hard",
threads: true,
q: `<p>Write a lock-free Treiber stack that is safe from ABA. The top of the stack is one 64-bit atomic word holding the node pointer in its low 32 bits and a version tag in its high 32 bits (this code runs as 32-bit WebAssembly, so pointers are 32 bits). Every successful update increments the tag. Nodes are never freed. The checks have four threads repeatedly pop a node and push it back, which is the pattern that triggers ABA.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <pthread.h>
#include <stdatomic.h>
#include <sched.h>

typedef struct node { struct node *next; int value; } node_t;
typedef struct { _Atomic uint64_t top; } tstack_t;

static inline node_t *ptr_of(uint64_t w) { return (node_t *)(uintptr_t)(uint32_t)w; }
static inline uint32_t tag_of(uint64_t w) { return (uint32_t)(w >> 32); }
static inline uint64_t pack(node_t *p, uint32_t tag) { return (uint64_t)tag << 32 | (uint32_t)(uintptr_t)p; }`,
todo: String.raw`void ts_push(tstack_t *s, node_t *n) {
    /* TODO */
}

node_t *ts_pop(tstack_t *s) {
    /* TODO */
    return NULL;
}`,
impl: String.raw`void ts_push(tstack_t *s, node_t *n) {
    uint64_t old = atomic_load_explicit(&s->top, memory_order_relaxed);
    do {
        n->next = ptr_of(old);
    } while (!atomic_compare_exchange_weak_explicit(&s->top, &old, pack(n, tag_of(old) + 1),
                                                    memory_order_release, memory_order_relaxed));
}

node_t *ts_pop(tstack_t *s) {
    uint64_t old = atomic_load_explicit(&s->top, memory_order_acquire);
    node_t *p;
    do {
        p = ptr_of(old);
        if (!p) return NULL;
        /* If another thread pops p and pushes it back meanwhile, the tag
           has changed, so this CAS fails instead of installing a stale next. */
    } while (!atomic_compare_exchange_weak_explicit(&s->top, &old, pack(p->next, tag_of(old) + 1),
                                                    memory_order_acquire, memory_order_acquire));
    return p;
}`,
tests: String.raw`#define NODES 16
#define THREADS 4
#define ITERS 1500

static tstack_t st;
static node_t pool[NODES];
static int empty_pops;

static void *worker(void *arg) {
    (void)arg;
    for (int i = 0; i < ITERS; i++) {
        node_t *n = ts_pop(&st);
        if (!n) { empty_pops++; sched_yield(); continue; }
        sched_yield();
        ts_push(&st, n);
    }
    return NULL;
}

int main(void) {
    /* One thread: LIFO order. */
    for (int i = 0; i < 3; i++) { pool[i].value = i; ts_push(&st, &pool[i]); }
    node_t *a = ts_pop(&st), *b = ts_pop(&st), *c = ts_pop(&st);
    CHECK(a == &pool[2] && b == &pool[1] && c == &pool[0] && ts_pop(&st) == NULL, "pops must be LIFO, then NULL");

    for (int i = 0; i < NODES; i++) { pool[i].value = i; ts_push(&st, &pool[i]); }
    pthread_t t[THREADS];
    for (int i = 0; i < THREADS; i++) pthread_create(&t[i], NULL, worker, NULL);
    for (int i = 0; i < THREADS; i++) pthread_join(t[i], NULL);

    /* Every node must be on the stack exactly once, with no cycle. */
    int seen[NODES] = {0}, count = 0, dup = 0;
    for (node_t *n = ptr_of(atomic_load(&st.top)); n && count < 100; n = n->next, count++) {
        int k = (int)(n - pool);
        if (k < 0 || k >= NODES || seen[k]++) dup = 1;
    }
    CHECK(count == NODES && !dup, "after the run the stack holds %d nodes (duplicates: %d), expected %d distinct", count, dup, NODES);
    CHECK(empty_pops == 0, "with %d nodes and %d threads a pop should never find the stack empty", NODES, THREADS);
    return REPORT();
}`,
a: `<p>Push links the new node to the current top and swings the top to it with a CAS, retrying from the value the failed CAS returns. Pop reads the top, reads its <code>next</code>, and swings the top to <code>next</code>. Both bump the tag.</p>
<p>The tag is what makes pop safe. Without it, thread 1 can read top = A and next = B and be preempted. Thread 2 then pops A, pops B, and pushes A back. The top is A again, so thread 1’s CAS succeeds and installs B, which another thread now owns. Two threads hold B, and the stack has lost or duplicated nodes. With a tag, the top word changed from (A, <em>t</em>) to (A, <em>t</em> + 3), so the CAS fails and thread 1 retries.</p>
<p>A 32-bit tag can in principle wrap back to the same value while a thread is preempted, but that takes 2<sup>32</sup> updates. On x86-64, pointers are 64 bits, so the same design needs <code>cmpxchg16b</code> or a tag packed into the unused upper 16 address bits. Nodes are never freed here. With real memory reclamation, reading <code>p-&gt;next</code> after <code>p</code> was freed is a second bug, which hazard pointers or epochs solve.</p>`
});

C("intv-diag", "chains", {
lvl: "hard",
q: `<p>Build a first-order interval model (after Eyerman, Eeckhout, and Karkhanis) that turns a trace of miss events into a CPI stack. A core of <code>width</code> dispatches <code>n</code> instructions at full width except during miss intervals:</p>
<ul>
<li><strong>Base:</strong> <code>n / width</code> cycles.</li>
<li><strong>Branch:</strong> each mispredicted branch adds <code>br_penalty</code> cycles (front-end refill plus the time the branch took to resolve).</li>
<li><strong>Memory:</strong> a long-latency load adds <code>mem_lat</code> cycles, unless it falls within <code>rob</code> instructions after the load that started the current miss group. Such loads overlap with that load and add nothing. A load further away starts a new group.</li>
<li><strong>I-cache:</strong> each instruction-cache miss adds <code>ic_lat</code> cycles. These never overlap with each other or with data misses.</li>
</ul>
<p><code>events</code> lists events in instruction order. Return the cycles in each component.</p>`,
head: String.raw`#include <stdio.h>

typedef enum { BR_MISS, LOAD_MISS, IC_MISS } ev_kind_t;
typedef struct { long instr; ev_kind_t kind; } event_t;

typedef struct {
    int width, rob;
    double br_penalty, mem_lat, ic_lat;
} core_t;

typedef struct { double base, branch, memory, icache; } stack_t;`,
todo: String.raw`stack_t cpi_stack(const core_t *c, long n, const event_t *ev, int nev) {
    stack_t s = {0};
    /* TODO */
    return s;
}`,
impl: String.raw`stack_t cpi_stack(const core_t *c, long n, const event_t *ev, int nev) {
    stack_t s = { (double)n / c->width, 0, 0, 0 };
    long group_start = -1;   /* instruction of the load that opened the group */
    for (int i = 0; i < nev; i++) {
        switch (ev[i].kind) {
        case BR_MISS: s.branch += c->br_penalty; break;
        case IC_MISS: s.icache += c->ic_lat; break;
        case LOAD_MISS:
            if (group_start < 0 || ev[i].instr - group_start >= c->rob) {
                s.memory += c->mem_lat;
                group_start = ev[i].instr;
            }
            break;
        }
    }
    return s;
}`,
tests: String.raw`#include <math.h>
#define NEAR(a, b) (fabs((a) - (b)) < 1e-6)

int main(void) {
    core_t golden = { 6, 512, 17, 350, 20 };
    event_t ev[] = {
        {1000, LOAD_MISS}, {1300, LOAD_MISS}, {1600, LOAD_MISS}, {1900, LOAD_MISS},
        {2112, LOAD_MISS},                     /* exactly 512 after 1600 */
        {3000, BR_MISS}, {3500, BR_MISS},
        {4000, IC_MISS},
        {9000, LOAD_MISS}
    };
    stack_t s = cpi_stack(&golden, 60000, ev, 9);
    CHECK(NEAR(s.base, 10000) && NEAR(s.branch, 34) && NEAR(s.memory, 1400) && NEAR(s.icache, 20),
          "got base %.0f branch %.0f memory %.0f icache %.0f", s.base, s.branch, s.memory, s.icache);

    /* The same events on a Skylake-sized window: 224 entries, 4 wide. */
    core_t sky = { 4, 224, 16, 350, 20 };
    s = cpi_stack(&sky, 60000, ev, 9);
    CHECK(NEAR(s.base, 15000) && NEAR(s.memory, 1750),
          "Skylake-sized: base %.0f memory %.0f, expected 15000 and 1750", s.base, s.memory);
    double cpi = (s.base + s.branch + s.memory + s.icache) / 60000;
    CHECK(NEAR(cpi, (15000 + 32 + 1750 + 20) / 60000.0), "CPI %.4f", cpi);

    CHECK(NEAR(cpi_stack(&sky, 0, ev, 0).base, 0), "no instructions, no cycles");
    return REPORT();
}`,
a: `<p>The model is a sum: a base term at full width plus one penalty per miss interval. The only state needed is where the current group of overlapping loads started. A load within one ROB’s worth of instructions after that load was already in the window when the first miss stalled retirement, so its latency hides under the first one. A load further away can’t have been in the window, so it opens a new group and pays the full latency. This is the main reason ROB size matters for memory-bound code.</p>
<p>In the example, with a 512-entry ROB, the load at 1,300 overlaps the one at 1,000, the load at 1,600 opens a group that 1,900 joins, and 2,112 is exactly 512 instructions after 1,600, so it opens another. With the load at 9,000 that is four groups, 4 × 350 = 1,400 cycles. With 224 entries, loads 300 instructions apart never overlap, and only 2,112 joins the group opened at 1,900: five groups, 1,750 cycles.</p>
<p>The value of an interval model in an interview: it explains a CPI stack in a few lines, and it says what each fix buys. Halving branch mispredictions saves the branch component, a bigger ROB merges memory groups, and a wider core shrinks only the base. Its known weaknesses are worth naming too: it ignores dependences between misses (pointer chasing never overlaps), bandwidth limits, and partial overlap.</p>`
});

C("intv-diag", "metrics", {
lvl: "medium",
q: `<p>Compute top-down level 1 (Yasin, 2014) from Skylake counters. A Skylake core has 4 issue slots per cycle:</p>
<ul>
<li>slots = 4 × <code>CPU_CLK_UNHALTED.THREAD</code></li>
<li>Frontend Bound = <code>IDQ_UOPS_NOT_DELIVERED.CORE</code> / slots</li>
<li>Bad Speculation = (<code>UOPS_ISSUED.ANY</code> − <code>UOPS_RETIRED.RETIRE_SLOTS</code> + 4 × <code>INT_MISC.RECOVERY_CYCLES</code>) / slots</li>
<li>Retiring = <code>UOPS_RETIRED.RETIRE_SLOTS</code> / slots</li>
<li>Backend Bound = 1 − (the other three)</li>
</ul>
<p>Counters are sampled with multiplexing, so the four fractions can drift slightly outside [0, 1]. Clamp each to that range, then renormalize so they sum to 1. Also return the largest category’s name.</p>`,
head: String.raw`#include <stdio.h>
#include <math.h>

typedef struct {
    double clk, idq_not_delivered, uops_issued, retire_slots, recovery_cycles;
} counters_t;

typedef struct {
    double fe, bad_spec, retiring, be;
    const char *top;
} topdown_t;`,
todo: String.raw`topdown_t topdown(counters_t c) {
    topdown_t t = {0};
    /* TODO */
    return t;
}`,
impl: String.raw`static double clamp01(double x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

topdown_t topdown(counters_t c) {
    topdown_t t;
    double slots = 4 * c.clk;
    t.fe = clamp01(c.idq_not_delivered / slots);
    t.bad_spec = clamp01((c.uops_issued - c.retire_slots + 4 * c.recovery_cycles) / slots);
    t.retiring = clamp01(c.retire_slots / slots);
    t.be = clamp01(1 - (t.fe + t.bad_spec + t.retiring));
    double sum = t.fe + t.bad_spec + t.retiring + t.be;
    t.fe /= sum; t.bad_spec /= sum; t.retiring /= sum; t.be /= sum;
    t.top = "Frontend Bound";
    double best = t.fe;
    if (t.bad_spec > best) { best = t.bad_spec; t.top = "Bad Speculation"; }
    if (t.retiring > best) { best = t.retiring; t.top = "Retiring"; }
    if (t.be > best) { t.top = "Backend Bound"; }
    return t;
}`,
tests: String.raw`#include <string.h>
#define NEAR(a, b) (fabs((a) - (b)) < 1e-9)

int main(void) {
    /* A memory-bound run: 10 billion cycles, 12 billion uops retired. */
    counters_t c = { 10e9, 4e9, 13e9, 12e9, 0.1e9 };
    topdown_t t = topdown(c);
    CHECK(NEAR(t.fe, 0.10) && NEAR(t.bad_spec, 0.035) && NEAR(t.retiring, 0.30) && NEAR(t.be, 0.565),
          "got FE %.4f BS %.4f RET %.4f BE %.4f", t.fe, t.bad_spec, t.retiring, t.be);
    CHECK(strcmp(t.top, "Backend Bound") == 0, "top category %s, expected Backend Bound", t.top);

    /* A branchy, front-end-heavy run. */
    counters_t b = { 2e9, 3.04e9, 4.36e9, 3.0e9, 0.15e9 };
    t = topdown(b);
    CHECK(NEAR(t.fe, 0.38) && NEAR(t.bad_spec, 0.245) && NEAR(t.retiring, 0.375) && NEAR(t.be, 0.0),
          "got FE %.4f BS %.4f RET %.4f BE %.4f", t.fe, t.bad_spec, t.retiring, t.be);
    CHECK(strcmp(t.top, "Frontend Bound") == 0, "top category %s, expected Frontend Bound", t.top);

    /* Multiplexing drift: Bad Speculation comes out negative and clamps to
       0, Frontend and Retiring sum to 1.05, so Backend clamps to 0 and the
       rest scale down by 1.05. */
    counters_t d = { 1e9, 1.2e9, 1.0e9, 3.0e9, 0 };
    t = topdown(d);
    CHECK(t.be == 0 && NEAR(t.fe, 0.30 / 1.05) && NEAR(t.retiring, 0.75 / 1.05) && t.bad_spec == 0,
          "drift: FE %.4f BS %.4f RET %.4f BE %.4f", t.fe, t.bad_spec, t.retiring, t.be);
    CHECK(NEAR(t.fe + t.bad_spec + t.retiring + t.be, 1.0), "the categories must sum to 1");
    return REPORT();
}`,
a: `<p>Everything is measured in issue slots, 4 per cycle on Skylake. Front-end bound counts slots the front end left empty while the back end could have taken uops. Bad speculation counts uops issued but never retired, plus the slots lost while the machine recovered from a mispredict (4 per recovery cycle). Retiring is useful work. Backend bound is the remainder.</p>
<p>Check the first case by hand: 4 × 10 billion = 40 billion slots. Front end 4/40 = 10%. Bad speculation (13 − 12 + 0.4)/40 = 3.5%. Retiring 12/40 = 30%. Backend bound is the remaining 56.5%, so the next step is level 2 (memory bound versus core bound) for the back end.</p>
<p>The clamp-and-renormalize step matters in practice: with counter multiplexing, the events are sampled over different intervals, and a raw negative Backend Bound or a sum above 100% will confuse anyone reading the report. Newer Intel cores (Ice Lake and later) have dedicated <code>TOPDOWN</code> slot counters that avoid most of this, and use a different slot width per core, so don’t hard-code 4 outside Skylake-era parts.</p>`
});

C("intv-sim", "struct", {
lvl: "medium",
q: `<p>Write the event queue of a discrete-event simulator as a binary min-heap. Events are ordered by time, and events at the same time must come out in the order they were scheduled, so runs are deterministic. <code>eq_push()</code> schedules an event and <code>eq_pop()</code> removes the earliest. Both must be O(log n), and the queue grows as needed.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

typedef struct { uint64_t time; int id; } event_t;`,
todo: String.raw`typedef struct {
    /* TODO */
    int n;
} eq_t;

void eq_init(eq_t *q) {
    /* TODO */
}

void eq_push(eq_t *q, uint64_t time, int id) {
    /* TODO */
}

/* Returns 0 if empty. */
int eq_pop(eq_t *q, event_t *out) {
    /* TODO */
    return 0;
}`,
impl: String.raw`typedef struct { uint64_t time, seq; int id; } node_t;

typedef struct {
    node_t *h;
    int n, cap;
    uint64_t seq;   /* scheduling order breaks ties */
} eq_t;

static int before(const node_t *a, const node_t *b) {
    return a->time != b->time ? a->time < b->time : a->seq < b->seq;
}

void eq_init(eq_t *q) { q->h = NULL; q->n = q->cap = 0; q->seq = 0; }

void eq_push(eq_t *q, uint64_t time, int id) {
    if (q->n == q->cap) {
        q->cap = q->cap ? 2 * q->cap : 16;
        q->h = realloc(q->h, sizeof(node_t) * q->cap);
    }
    int i = q->n++;
    node_t x = { time, q->seq++, id };
    while (i > 0 && before(&x, &q->h[(i - 1) / 2])) {   /* sift up */
        q->h[i] = q->h[(i - 1) / 2];
        i = (i - 1) / 2;
    }
    q->h[i] = x;
}

int eq_pop(eq_t *q, event_t *out) {
    if (q->n == 0) return 0;
    *out = (event_t){ q->h[0].time, q->h[0].id };
    node_t x = q->h[--q->n];
    int i = 0;
    for (;;) {                                          /* sift down */
        int c = 2 * i + 1;
        if (c >= q->n) break;
        if (c + 1 < q->n && before(&q->h[c + 1], &q->h[c])) c++;
        if (!before(&q->h[c], &x)) break;
        q->h[i] = q->h[c];
        i = c;
    }
    q->h[i] = x;
    return 1;
}`,
tests: String.raw`int main(void) {
    eq_t q;
    event_t e;
    eq_init(&q);
    CHECK(eq_pop(&q, &e) == 0, "an empty queue must return 0");

    eq_push(&q, 30, 1); eq_push(&q, 10, 2); eq_push(&q, 20, 3);
    eq_push(&q, 10, 4); eq_push(&q, 10, 5);
    int want[5] = {2, 4, 5, 3, 1}, ok = 1;
    for (int i = 0; i < 5; i++) ok &= eq_pop(&q, &e) && e.id == want[i];
    CHECK(ok, "order should be 2, 4, 5 (ties in scheduling order), 3, 1");

    /* 100,000 random events, with heavy ties, popped while new ones arrive. */
    srand(5);
    eq_init(&q);
    uint64_t now = 0, last_time = 0;
    int last_id = -1, bad = 0, popped = 0, id = 0;
    int *seen_at = calloc(200000, sizeof(int));
    for (int i = 0; i < 100000; i++) {
        uint64_t t = now + rand() % 8;   /* many events share a time */
        seen_at[id] = (int)t;
        eq_push(&q, t, id++);
        if (rand() % 3 == 0 && eq_pop(&q, &e)) {
            if (e.time < last_time || (e.time == last_time && e.id < last_id)) bad++;
            last_time = now = e.time; last_id = e.id; popped++;
        }
    }
    while (eq_pop(&q, &e)) {
        if (e.time < last_time || (e.time == last_time && e.id < last_id) || (int)e.time != seen_at[e.id]) bad++;
        last_time = e.time; last_id = e.id; popped++;
    }
    CHECK(bad == 0, "%d events came out of order", bad);
    CHECK(popped == 100000, "popped %d events, expected 100000", popped);
    return REPORT();
}`,
a: `<p>A binary heap in an array: the children of node <em>i</em> are 2<em>i</em> + 1 and 2<em>i</em> + 2. Push appends and sifts up, pop moves the last element to the root and sifts down toward the smaller child. Moving a hole instead of swapping halves the copies.</p>
<p>The detail that matters for a simulator is the tie-break. A heap is not stable, so two events at the same cycle can come out in either order, and the order changes when unrelated events are added. A model whose results depend on that is nondeterministic, which makes regressions impossible to bisect. Adding a sequence number to the key makes equal-time events FIFO.</p>
<p>For cycle-level models with many events a few cycles ahead, a calendar queue or a timing wheel (an array of buckets indexed by time modulo its size) gives O(1) push and pop and is what many simulators use. The heap is the right default when event times spread widely.</p>`
});

C("intv-sim", "cycle", {
lvl: "hard",
q: `<p>Simulate credit-based flow control on a link with latency <code>L</code> into a receive buffer of <code>B</code> entries, and return the cycle the last of <code>n</code> items is consumed, plus 1. The sender starts with <code>B</code> credits. In each cycle <em>c</em>, in this order:</p>
<ol>
<li><strong>Consume:</strong> if <em>c</em> is a multiple of <code>k</code> and the buffer isn’t empty, the receiver removes one item and sends a credit back, which arrives at cycle <em>c</em> + <code>L</code>.</li>
<li><strong>Arrive:</strong> items sent in cycle <em>c</em> − <code>L</code> enter the buffer.</li>
<li><strong>Credits:</strong> credits due at cycle <em>c</em> reach the sender.</li>
<li><strong>Send:</strong> if the sender has a credit and items remain, it spends one and sends one item.</li>
</ol>
<p>The order matters: an item that arrives in cycle <em>c</em> can be consumed in cycle <em>c</em> + 1 at the earliest, and a credit that arrives in cycle <em>c</em> can be used in cycle <em>c</em>.</p>`,
head: String.raw`#include <stdio.h>
#include <stdlib.h>`,
todo: String.raw`long run_link(int n, int L, int B, int k) {
    /* TODO */
    return 0;
}`,
impl: String.raw`long run_link(int n, int L, int B, int k) {
    /* Delay lines indexed by cycle modulo L + 1: items in flight and
       credits in flight. At most one of each is sent per cycle. */
    int *item = calloc(L + 1, sizeof(int)), *credit = calloc(L + 1, sizeof(int));
    int credits = B, buffered = 0, sent = 0, consumed = 0;
    long c = 0, last = 0;
    for (; consumed < n; c++) {
        int slot = (int)(c % (L + 1));
        if (c % k == 0 && buffered > 0) {
            buffered--; consumed++; last = c;
            credit[(c + L) % (L + 1)]++;
        }
        buffered += item[slot]; item[slot] = 0;
        credits += credit[slot]; credit[slot] = 0;
        if (credits > 0 && sent < n) {
            credits--; sent++;
            item[(c + L) % (L + 1)]++;
        }
    }
    free(item); free(credit);
    return last + 1;
}`,
tests: String.raw`int main(void) {
    /* Round trip for a credit is 2L + 1 cycles: send, arrive after L,
       consume one cycle later, credit back after L. */
    long r = run_link(100, 4, 9, 1);
    CHECK(r == 105, "B = 2L+1 = 9: %ld cycles, expected 105 (full rate)", r);
    r = run_link(100, 4, 20, 1);
    CHECK(r == 105, "more buffer than the round trip doesn't help: %ld, expected 105", r);
    r = run_link(100, 4, 4, 1);
    CHECK(r == 225, "B = 4 < 9: %ld cycles, expected 225 (4 items per 9 cycles)", r);
    r = run_link(100, 4, 9, 2);
    CHECK(r == 205, "receiver takes every 2nd cycle: %ld, expected 205", r);
    r = run_link(6, 4, 2, 2);
    CHECK(r == 29, "B = 2, every 2nd cycle, 6 items: %ld, expected 29", r);
    r = run_link(1, 1, 1, 1);
    CHECK(r == 3, "one item, latency 1: %ld, expected 3", r);
    return REPORT();
}`,
a: `<p>The structure of any cycle-level model: state in delay lines, and a fixed order of phases within a cycle. A delay line of <code>L</code> + 1 slots indexed by cycle modulo its size holds what arrives in each future cycle. The order of the four phases is the spec. Swap consume and arrive and every item can be consumed in its arrival cycle, which removes a cycle from the round trip and changes every number.</p>
<p>The result to remember: a credit makes a round trip of 2<code>L</code> + 1 cycles here, so the link runs at full rate only if <code>B</code> ≥ 2<code>L</code> + 1. Below that, throughput is <code>B</code> / (2<code>L</code> + 1): with <code>L</code> = 4 and <code>B</code> = 4, the sender sends a burst of 4 every 9 cycles. Item 99 is sent in cycle 24 × 9 + 3 = 219 and consumed 5 cycles later, so the run takes 225 cycles. This is the same bandwidth-delay product that sizes NoC router buffers and PCIe flow-control credits.</p>
<p>When the receiver is the bottleneck (every 2nd cycle), buffer size stops mattering once it covers the round trip at the receiver’s rate. The 6-item case with <code>B</code> = 2 is worth tracing by hand: the consume times land on 6, 8, 16, 18, 26, 28, because each credit’s trip is stretched to the next even cycle.</p>`
});

C("intv-alloc", "alloc", {
lvl: "hard",
q: `<p>Implement <code>my_malloc</code> and <code>my_free</code> over a fixed 1 MiB arena, without calling the C library’s allocator.</p>
<ul>
<li>Return 16-byte aligned pointers, NULL when a request can’t be met, and NULL for size 0. <code>my_free(NULL)</code> does nothing.</li>
<li>Use at most 16 bytes of overhead per allocated block.</li>
<li>Coalesce freed neighbors immediately: after everything has been freed, a single request for the arena size minus 64 bytes must succeed, whatever order the blocks were freed in.</li>
</ul>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define ARENA (1 << 20)
static _Alignas(16) uint8_t heap[ARENA];`,
todo: String.raw`void *my_malloc(size_t n) {
    /* TODO */
    return NULL;
}

void my_free(void *p) {
    /* TODO */
}`,
impl: String.raw`/* Blocks are multiples of 16 bytes and start 8 bytes before a 16-byte
   boundary: an 8-byte header (size | allocated bit), the payload, and an
   8-byte footer copying the header. Free blocks keep an explicit doubly
   linked free list in their payload. A permanently allocated epilogue
   header at the end stops coalescing. */
typedef struct { uint32_t size_alloc, pad; } tag_t;
typedef struct fblock { struct fblock *prev, *next; } fblock_t;
#define MIN_BLOCK 32
static fblock_t *free_list;
static int ready;

static tag_t *hdr(uint8_t *b) { return (tag_t *)b; }
static uint32_t bsize(uint8_t *b) { return hdr(b)->size_alloc & ~1u; }
static int is_alloc(uint8_t *b) { return hdr(b)->size_alloc & 1; }
static void set(uint8_t *b, uint32_t size, int alloc) {
    hdr(b)->size_alloc = size | (uint32_t)alloc;
    ((tag_t *)(b + size - 8))->size_alloc = size | (uint32_t)alloc;   /* footer */
}
static fblock_t *fb(uint8_t *b) { return (fblock_t *)(b + 8); }
static uint8_t *blk(fblock_t *f) { return (uint8_t *)f - 8; }

static void list_add(uint8_t *b) {
    fblock_t *f = fb(b);
    f->prev = NULL; f->next = free_list;
    if (free_list) free_list->prev = f;
    free_list = f;
}
static void list_del(uint8_t *b) {
    fblock_t *f = fb(b);
    if (f->prev) f->prev->next = f->next; else free_list = f->next;
    if (f->next) f->next->prev = f->prev;
}

static void init(void) {
    uint8_t *first = heap + 8;                 /* payload lands on 16 */
    set(first, ARENA - 16, 0);
    hdr(heap + ARENA - 8)->size_alloc = 1;     /* epilogue: size 0, allocated */
    free_list = NULL;
    list_add(first);
    ready = 1;
}

void *my_malloc(size_t n) {
    if (!ready) init();
    if (n == 0 || n > ARENA) return NULL;
    uint32_t need = (uint32_t)((n + 16 + 15) & ~(size_t)15);
    if (need < MIN_BLOCK) need = MIN_BLOCK;
    for (fblock_t *f = free_list; f; f = f->next) {          /* first fit */
        uint8_t *b = blk(f);
        uint32_t size = bsize(b);
        if (size < need) continue;
        list_del(b);
        if (size - need >= MIN_BLOCK) {                       /* split */
            set(b, need, 1);
            set(b + need, size - need, 0);
            list_add(b + need);
        } else {
            set(b, size, 1);
        }
        return b + 8;
    }
    return NULL;
}

void my_free(void *p) {
    if (!p) return;
    uint8_t *b = (uint8_t *)p - 8;
    uint32_t size = bsize(b);
    uint8_t *next = b + size;
    if (!is_alloc(next)) { list_del(next); size += bsize(next); }
    if (b > heap + 8) {
        tag_t *prev_ftr = (tag_t *)(b - 8);
        if (!(prev_ftr->size_alloc & 1)) {
            uint8_t *prev = b - (prev_ftr->size_alloc & ~1u);
            list_del(prev);
            size += bsize(prev);
            b = prev;
        }
    }
    set(b, size, 0);
    list_add(b);
}`,
tests: String.raw`#define N 600

int main(void) {
    CHECK(my_malloc(0) == NULL, "my_malloc(0) should return NULL");
    my_free(NULL);
    CHECK(my_malloc(ARENA) == NULL, "a request larger than the arena must fail");

    /* Random sizes, each block filled with a pattern, checked before freeing. */
    static uint8_t *p[N];
    static size_t sz[N];
    srand(11);
    int misaligned = 0, outside = 0, corrupt = 0, failed = 0;
    for (int i = 0; i < N; i++) {
        sz[i] = 1 + rand() % (rand() % 4 ? 200 : 3000);
        p[i] = my_malloc(sz[i]);
        if (!p[i]) { failed++; continue; }
        if ((uintptr_t)p[i] % 16) misaligned++;
        if (p[i] < heap || p[i] + sz[i] > heap + ARENA) outside++;
        memset(p[i], i & 0xFF, sz[i]);
    }
    CHECK(failed == 0, "%d of %d allocations failed (about 270 KB requested)", failed, N);
    CHECK(misaligned == 0, "%d pointers were not 16-byte aligned", misaligned);
    CHECK(outside == 0, "%d blocks fall outside the arena", outside);

    /* Free every other block, reallocate into the holes, then free all in random order. */
    for (int i = 0; i < N; i += 2) {
        for (size_t k = 0; k < sz[i]; k++) if (p[i][k] != (uint8_t)(i & 0xFF)) { corrupt++; break; }
        my_free(p[i]);
        sz[i] = 1 + rand() % 100;
        p[i] = my_malloc(sz[i]);
        if (p[i]) memset(p[i], i & 0xFF, sz[i]);
    }
    int order[N];
    for (int i = 0; i < N; i++) order[i] = i;
    for (int i = N - 1; i > 0; i--) { int j = rand() % (i + 1), t = order[i]; order[i] = order[j]; order[j] = t; }
    for (int k = 0; k < N; k++) {
        int i = order[k];
        if (!p[i]) continue;
        for (size_t b = 0; b < sz[i]; b++) if (p[i][b] != (uint8_t)(i & 0xFF)) { corrupt++; break; }
        my_free(p[i]);
    }
    CHECK(corrupt == 0, "%d blocks were overwritten by other blocks", corrupt);

    /* Everything is free: the whole arena must have coalesced back. */
    void *big = my_malloc(ARENA - 64);
    CHECK(big != NULL, "after freeing everything, a %d-byte request should succeed", ARENA - 64);
    my_free(big);
    void *again = my_malloc(ARENA - 64);
    CHECK(again == big, "and succeed again at the same address after freeing it");
    return REPORT();
}`,
a: `<p>The layout decides everything else. Keep block sizes a multiple of 16 and start each block 8 bytes before a 16-byte boundary, so an 8-byte header puts every payload on 16. An 8-byte footer copies the header, giving 16 bytes of overhead per block. A block’s size field also locates the next block’s header, and the previous block’s footer sits just before the header, so both neighbors are O(1) to find.</p>
<p><code>my_malloc</code> rounds the request plus overhead up to 16, scans an explicit free list (threaded through the free blocks’ payloads) for the first block that fits, and splits off the remainder if it can hold a minimum block. <code>my_free</code> checks the next header and the previous footer and merges with whichever neighbors are free, removing them from the list first. A permanently allocated epilogue at the end, and the arena start check, keep coalescing inside the arena.</p>
<p>Points an interviewer will push on:</p>
<ul>
<li><strong>Placement:</strong> first fit on a LIFO list is fast but fragments more than address-ordered first fit or best fit. Segregated lists per size range (what glibc’s bins and dlmalloc do) get close to best fit at near-constant cost.</li>
<li><strong>Footers on allocated blocks</strong> can be dropped with a previous-allocated bit in the header.</li>
<li><strong>Thread safety</strong> needs a lock, or per-thread arenas.</li>
<li><strong>A double free or a bad pointer</strong> silently corrupts the lists. Hardened allocators check the header and keep free-list pointers protected.</li>
</ul>`
});

C("intv-alloc", "alloc", {
lvl: "medium",
q: `<p>Wrap the system allocator to add <code>x_realloc</code>, <code>x_calloc</code>, and <code>x_aligned_alloc</code>, keeping a small header before each block that records what you need. Use only <code>malloc</code> and <code>free</code> underneath.</p>
<ul>
<li><code>x_realloc(NULL, n)</code> acts like <code>x_malloc(n)</code>, and <code>x_realloc(p, 0)</code> frees <code>p</code> and returns NULL. Shrinking, or growing within the block’s recorded capacity, must not move the block. Otherwise copy the old contents, and on failure leave the old block untouched and return NULL.</li>
<li><code>x_calloc(n, size)</code> returns zeroed memory, and NULL if <code>n × size</code> overflows.</li>
<li><code>x_aligned_alloc(align, n)</code> returns memory aligned to <code>align</code> (a power of two up to 4,096), and <code>x_free</code> must accept it like any other block.</li>
<li><code>x_malloc</code> returns 16-byte aligned memory with capacity rounded up to 16 bytes.</li>
</ul>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>`,
todo: String.raw`void *x_malloc(size_t n) {
    /* TODO */
    return NULL;
}

void x_free(void *p) {
    /* TODO */
}

void *x_realloc(void *p, size_t n) {
    /* TODO */
    return NULL;
}

void *x_calloc(size_t n, size_t size) {
    /* TODO */
    return NULL;
}

void *x_aligned_alloc(size_t align, size_t n) {
    /* TODO */
    return NULL;
}`,
impl: String.raw`/* A 16-byte header just before every user pointer: the pointer malloc
   returned (needed to free an over-aligned block) and the capacity. */
typedef struct { void *base; size_t cap; char pad[16 - sizeof(void *) - sizeof(size_t)]; } xhdr_t;
_Static_assert(sizeof(xhdr_t) == 16, "header must keep 16-byte alignment");

static xhdr_t *H(void *p) { return (xhdr_t *)p - 1; }

void *x_aligned_alloc(size_t align, size_t n) {
    if (align < 16) align = 16;
    size_t cap = (n + 15) & ~(size_t)15;
    if (cap < n || cap > SIZE_MAX - sizeof(xhdr_t) - align) return NULL;
    uint8_t *base = malloc(cap + sizeof(xhdr_t) + align - 1);
    if (!base) return NULL;
    uintptr_t u = ((uintptr_t)base + sizeof(xhdr_t) + align - 1) & ~(uintptr_t)(align - 1);
    void *p = (void *)u;
    H(p)->base = base;
    H(p)->cap = cap;
    return p;
}

void *x_malloc(size_t n) { return x_aligned_alloc(16, n); }

void x_free(void *p) { if (p) free(H(p)->base); }

void *x_realloc(void *p, size_t n) {
    if (!p) return x_malloc(n);
    if (n == 0) { x_free(p); return NULL; }
    if (n <= H(p)->cap) return p;                  /* fits: don't move */
    void *q = x_malloc(n);
    if (!q) return NULL;                           /* old block stays valid */
    memcpy(q, p, H(p)->cap);
    x_free(p);
    return q;
}

void *x_calloc(size_t n, size_t size) {
    if (size && n > SIZE_MAX / size) return NULL;  /* n * size would overflow */
    void *p = x_malloc(n * size);
    if (p) memset(p, 0, n * size);
    return p;
}`,
tests: String.raw`int main(void) {
    char *p = x_malloc(10);
    CHECK(p && (uintptr_t)p % 16 == 0, "x_malloc should return 16-byte aligned memory");
    strcpy(p, "123456789");
    char *q = x_realloc(p, 16);
    CHECK(q == p, "growing within the rounded capacity (16) must not move the block");
    q = x_realloc(p, 4);
    CHECK(q == p && strncmp(q, "1234", 4) == 0, "shrinking must not move the block");
    char *r = x_realloc(q, 1000);
    CHECK(r && strcmp(r, "123456789") == 0, "growing must keep the contents");
    CHECK(x_realloc(r, 0) == NULL, "realloc to 0 frees and returns NULL");
    char *s = x_realloc(NULL, 5);
    CHECK(s != NULL, "realloc(NULL, n) should allocate");
    x_free(s);

    int *z = x_calloc(1000, sizeof(int));
    int zero = z != NULL;
    for (int i = 0; zero && i < 1000; i++) zero = z[i] == 0;
    CHECK(zero, "calloc must return zeroed memory");
    x_free(z);
    CHECK(x_calloc(SIZE_MAX / 2, 3) == NULL, "calloc must detect n * size overflow");

    int ok = 1;
    for (size_t a = 16; a <= 4096; a *= 2) {
        void *m = x_aligned_alloc(a, 100);
        ok &= m && (uintptr_t)m % a == 0;
        if (m) memset(m, 0xAB, 100);
        x_free(m);
    }
    CHECK(ok, "aligned allocations must honor alignments from 16 to 4096");

    /* A huge request fails cleanly and leaves the old block intact. */
    char *keep = x_malloc(32);
    strcpy(keep, "still here");
    CHECK(x_realloc(keep, SIZE_MAX - 8) == NULL && strcmp(keep, "still here") == 0,
          "a failed realloc must return NULL and keep the old block");
    x_free(keep);
    return REPORT();
}`,
a: `<p>One header serves all three functions: store the pointer <code>malloc</code> returned and the usable capacity just before the user pointer, sized at 16 bytes so the user pointer stays 16-aligned. For an aligned allocation, over-allocate by <code>align − 1</code> plus the header, round the address up, and write the header right below it. <code>x_free</code> then always frees the stored base, whichever function made the block.</p>
<p>The edge cases are the interview:</p>
<ul>
<li><code>realloc</code> must not lose the old block if the new allocation fails, which is why <code>p = realloc(p, n)</code> is a leak in real code.</li>
<li>Growing within the existing capacity returns the same pointer, the cheap case real allocators take whenever the block’s size class has room.</li>
<li><code>calloc</code>’s overflow check (<code>n &gt; SIZE_MAX / size</code>) was missing from several historical C libraries, a real security bug class: a wrapped product allocates a tiny buffer and the caller then writes <code>n</code> elements.</li>
<li>Every size computation must be checked for overflow, including <code>cap + header + align</code>.</li>
</ul>
<p>Real allocators know a block’s size from their own metadata (the size class of its page), which is how <code>malloc_usable_size</code> works without a per-block header.</p>`
});

C("intv-alloc", "alloc", {
lvl: "medium",
q: `<p>Write a fixed-size object pool, the building block of slab allocators. <code>pool_init</code> carves a caller-provided buffer into objects of <code>obj_size</code> bytes (rounded up to 8). <code>pool_alloc</code> and <code>pool_free</code> must be O(1) and use no memory outside the buffer and the <code>pool_t</code> struct. <code>pool_free</code> must detect a double free or a pointer that isn’t an object in this pool and return −1 instead of corrupting the pool. Use a bitmap of up to 4,096 objects in the struct for that.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

#define MAXOBJ 4096`,
todo: String.raw`typedef struct {
    /* TODO */
    int free_count;
} pool_t;

int pool_init(pool_t *p, void *buf, size_t buf_size, size_t obj_size) {
    /* TODO: return the number of objects */
    return 0;
}

void *pool_alloc(pool_t *p) {
    /* TODO */
    return NULL;
}

int pool_free(pool_t *p, void *obj) {
    /* TODO: 0 on success, -1 on a bad or double free */
    return -1;
}`,
impl: String.raw`typedef struct {
    uint8_t *base;
    size_t obj;
    int count;
    void *head;                        /* free list threaded through free objects */
    uint64_t used[MAXOBJ / 64];        /* 1 = allocated */
    int free_count;
} pool_t;

int pool_init(pool_t *p, void *buf, size_t buf_size, size_t obj_size) {
    p->base = buf;
    p->obj = (obj_size + 7) & ~(size_t)7;
    if (p->obj < sizeof(void *)) p->obj = sizeof(void *);
    p->count = (int)(buf_size / p->obj);
    if (p->count > MAXOBJ) p->count = MAXOBJ;
    p->head = NULL;
    for (int i = p->count - 1; i >= 0; i--) {       /* lowest address first */
        void *o = p->base + (size_t)i * p->obj;
        *(void **)o = p->head;
        p->head = o;
    }
    for (int i = 0; i < MAXOBJ / 64; i++) p->used[i] = 0;
    p->free_count = p->count;
    return p->count;
}

void *pool_alloc(pool_t *p) {
    void *o = p->head;
    if (!o) return NULL;
    p->head = *(void **)o;
    size_t i = (size_t)((uint8_t *)o - p->base) / p->obj;
    p->used[i / 64] |= 1ull << (i % 64);
    p->free_count--;
    return o;
}

int pool_free(pool_t *p, void *obj) {
    uint8_t *o = obj;
    if (o < p->base) return -1;
    size_t off = (size_t)(o - p->base), i = off / p->obj;
    if (off % p->obj || i >= (size_t)p->count) return -1;     /* not an object start */
    if (!(p->used[i / 64] >> (i % 64) & 1)) return -1;        /* already free */
    p->used[i / 64] &= ~(1ull << (i % 64));
    *(void **)o = p->head;
    p->head = o;
    p->free_count++;
    return 0;
}`,
tests: String.raw`static _Alignas(16) uint8_t mem[64 * 1024];

int main(void) {
    pool_t p;
    int n = pool_init(&p, mem, sizeof mem, 60);    /* rounds to 64 */
    CHECK(n == 1024, "60-byte objects in 64 KiB: %d objects, expected 1024", n);

    void *a = pool_alloc(&p), *b = pool_alloc(&p);
    CHECK(a == mem && b == mem + 64, "first allocations should be the lowest addresses");
    CHECK(pool_free(&p, a) == 0, "freeing a live object should succeed");
    CHECK(pool_free(&p, a) == -1, "a double free must be detected");
    CHECK(pool_free(&p, (uint8_t *)b + 8) == -1, "a pointer into the middle of an object must be rejected");
    CHECK(pool_free(&p, mem + sizeof mem) == -1, "a pointer past the pool must be rejected");
    CHECK(pool_alloc(&p) == a, "the most recently freed object should be reused first (LIFO)");

    /* Exhaust, then refill. */
    static void *all[1024];
    int got = 2;
    all[0] = a; all[1] = b;
    while ((all[got] = pool_alloc(&p)) != NULL) got++;
    CHECK(got == 1024 && p.free_count == 0, "allocated %d objects before running out, expected 1024", got);
    int ok = 1;
    for (int i = 0; i < got; i++) ok &= pool_free(&p, all[i]) == 0;
    CHECK(ok && p.free_count == 1024, "every object should free once");

    pool_t q;
    CHECK(pool_init(&q, mem, 1024, 1) == 128, "1-byte objects round up to 8: 128 in 1 KiB");
    return REPORT();
}`,
a: `<p>A free object’s own memory holds the free-list link, so the pool needs no per-object metadata for allocation: allocation pops the head and free pushes onto it, both O(1). Rounding the object size up to 8 keeps every link aligned and leaves room for the pointer.</p>
<p>The bitmap is what makes <code>free</code> safe. An address is a valid object only if its offset from the base is a multiple of the object size and inside the pool. Its bit says whether it is currently allocated, so a double free is caught before it puts the same object on the list twice, which would hand it out to two callers later. That costs 1 bit per object, 512 bytes for 4,096 objects.</p>
<p>LIFO reuse is deliberate: the most recently freed object is the most likely to still be in the cache. Slab allocators (Bonwick’s, and the Linux kernel’s SLUB) build on this with one pool per object size and per CPU, and keep partially full slabs so memory can be returned when a slab empties.</p>`
});

C("intv-alloc", "frag", {
lvl: "hard",
q: `<p>Write a binary buddy allocator for a 1 MiB arena with 64-byte minimum blocks. A request gets the smallest power-of-two block of at least that size. Keep a free list per block size, take a block from the smallest nonempty size that fits, and when splitting always choose the lowest-addressed free block of that size and keep its lower half. <code>buddy_free</code> takes only the pointer, so record each allocated block’s size in a side table indexed by its address. On free, merge with the buddy (the address XOR the block size) while it is free and the same size.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stddef.h>

#define ARENA (1u << 20)
#define MIN_ORDER 6                /* 64 bytes */
#define MAX_ORDER 20               /* the whole arena */
static _Alignas(64) uint8_t arena[ARENA];`,
todo: String.raw`void buddy_init(void) {
    /* TODO */
}

void *buddy_alloc(size_t n) {
    /* TODO */
    return NULL;
}

void buddy_free(void *p) {
    /* TODO */
}`,
impl: String.raw`#define NBLK (ARENA >> MIN_ORDER)
/* Free blocks of each order as a bitmap over 64-byte granules (bit set at
   the block's first granule), so the lowest-addressed block of an order is
   a find-first-set. alloc_order[g] records the order of an allocated block. */
static uint64_t free_map[MAX_ORDER + 1][NBLK / 64];
static uint8_t alloc_order[NBLK];

static void mark(int order, uint32_t off, int on) {
    uint32_t g = off >> MIN_ORDER;
    if (on) free_map[order][g / 64] |= 1ull << (g % 64);
    else free_map[order][g / 64] &= ~(1ull << (g % 64));
}
static int is_free(int order, uint32_t off) {
    uint32_t g = off >> MIN_ORDER;
    return free_map[order][g / 64] >> (g % 64) & 1;
}
static int64_t lowest(int order) {
    for (uint32_t w = 0; w < NBLK / 64; w++)
        if (free_map[order][w]) return ((int64_t)w * 64 + __builtin_ctzll(free_map[order][w])) << MIN_ORDER;
    return -1;
}

void buddy_init(void) {
    for (int o = 0; o <= MAX_ORDER; o++)
        for (uint32_t w = 0; w < NBLK / 64; w++) free_map[o][w] = 0;
    mark(MAX_ORDER, 0, 1);
}

void *buddy_alloc(size_t n) {
    if (n == 0 || n > ARENA) return NULL;
    int want = MIN_ORDER;
    while (((size_t)1 << want) < n) want++;
    int o = want;
    while (o <= MAX_ORDER && lowest(o) < 0) o++;
    if (o > MAX_ORDER) return NULL;
    uint32_t off = (uint32_t)lowest(o);
    mark(o, off, 0);
    while (o > want) {                   /* split, keeping the lower half */
        o--;
        mark(o, off + (1u << o), 1);
    }
    alloc_order[off >> MIN_ORDER] = (uint8_t)want;
    return arena + off;
}

void buddy_free(void *p) {
    if (!p) return;
    uint32_t off = (uint32_t)((uint8_t *)p - arena);
    int o = alloc_order[off >> MIN_ORDER];
    while (o < MAX_ORDER) {
        uint32_t buddy = off ^ (1u << o);
        if (!is_free(o, buddy)) break;
        mark(o, buddy, 0);               /* merge */
        off &= ~(1u << o);
        o++;
    }
    mark(o, off, 1);
}`,
tests: String.raw`static long at(void *p) { return p ? (long)((uint8_t *)p - arena) : -1; }

int main(void) {
    buddy_init();
    void *a = buddy_alloc(3000);           /* 4 KiB block */
    void *b = buddy_alloc(9000);           /* 16 KiB block */
    void *c = buddy_alloc(64);             /* 64-byte block */
    CHECK(at(a) == 0, "3000 B: offset %ld, expected 0", at(a));
    CHECK(at(b) == 16384, "9000 B: offset %ld, expected 16384 (the free 16 KiB buddy)", at(b));
    CHECK(at(c) == 4096, "64 B: offset %ld, expected 4096 (splitting a's 4 KiB buddy)", at(c));
    void *d = buddy_alloc(65);
    CHECK(at(d) == 4224, "65 B: offset %ld, expected 4224 (a 128-byte block)", at(d));

    buddy_free(a);
    void *e = buddy_alloc(4096);
    CHECK(at(e) == 0, "a's block should be reused: %ld", at(e));
    buddy_free(e);
    buddy_free(c);
    buddy_free(d);
    void *f = buddy_alloc(8192);
    CHECK(at(f) == 0, "after freeing a, c, and d, 0 to 8 KiB merged back: %ld", at(f));
    buddy_free(f);
    CHECK(buddy_alloc(ARENA) == NULL, "b still holds 16 KiB, so the whole arena isn't free");
    buddy_free(b);
    void *g = buddy_alloc(ARENA);
    CHECK(at(g) == 0, "after freeing everything, the whole arena merges back: %ld", at(g));
    CHECK(buddy_alloc(1) == NULL, "a full arena refuses even 1 byte");
    buddy_free(g);

    /* Fill with 64-byte blocks, free every other one: nothing merges, so a
       128-byte request fails even though half the arena is free. */
    static void *blk[ARENA / 64];
    int n = 0;
    while ((blk[n] = buddy_alloc(64)) != NULL) n++;
    CHECK(n == ARENA / 64, "the arena holds %d 64-byte blocks, expected %d", n, ARENA / 64);
    for (int i = 0; i < n; i += 2) buddy_free(blk[i]);
    CHECK(buddy_alloc(128) == NULL, "fragmented: a 128-byte request must fail with only 64-byte holes");
    for (int i = 1; i < n; i += 2) buddy_free(blk[i]);
    CHECK(at(buddy_alloc(ARENA)) == 0, "after freeing the rest, everything merges again");
    return REPORT();
}`,
a: `<p>The buddy of a block at offset <em>x</em> with size 2<sup><em>k</em></sup> is at <em>x</em> XOR 2<sup><em>k</em></sup>, because a block of size 2<sup><em>k</em></sup> always sits at a multiple of 2<sup><em>k</em></sup>, and its pair in the larger parent differs only in bit <em>k</em>. Allocation splits a larger free block in halves until it reaches the wanted order, freeing each upper half. Free merges with the buddy while the buddy is free at the same order, clearing bit <em>k</em> each time to get the parent’s offset.</p>
<p>Two pieces of bookkeeping: whether a block is free at a given order (a bitmap per order here, which also makes “lowest address” a find-first-set), and each allocated block’s order (a byte per minimum block), because <code>free</code> receives only a pointer.</p>
<p>The checks trace the Math tab’s buddy question: 3,000 bytes splits 1 MiB down to 4 KiB at offset 0, 9,000 bytes takes the free 16 KiB buddy at 16,384, and a 64-byte request splits the 4 KiB buddy at 4,096. The last check shows the weakness: freeing every other 64-byte block leaves half the arena free, but no two free blocks are buddies, so nothing merges and even 128 bytes can’t be served. Linux’s page allocator uses this scheme with page-sized minimum blocks and adds per-CPU lists and migration types to reduce exactly that fragmentation.</p>`
});

C("intv-alloc", "libc", {
lvl: "hard",
q: `<p>Write <code>my_memmove</code> without calling any library copy function. It must be correct for every overlap, alignment, and length, and it must copy the bulk of the data 8 bytes at a time: copy single bytes until the destination is 8-byte aligned, then 8-byte words, then the tail. Choose the direction from the overlap, as the real function does.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>

/* An 8-byte type that may be unaligned and may alias anything. */
typedef uint64_t __attribute__((may_alias, aligned(1))) u64u;`,
todo: String.raw`void *my_memmove(void *dst, const void *src, size_t n) {
    /* TODO */
    return dst;
}`,
impl: String.raw`void *my_memmove(void *dst, const void *src, size_t n) {
    uint8_t *d = dst;
    const uint8_t *s = src;
    if (d == s || n == 0) return dst;
    if ((uintptr_t)d - (uintptr_t)s >= n) {
        /* dst is before src, or past its end: forward is safe. */
        while (n && ((uintptr_t)d & 7)) { *d++ = *s++; n--; }
        for (; n >= 8; n -= 8, d += 8, s += 8) *(u64u *)d = *(const u64u *)s;
        while (n--) *d++ = *s++;
    } else {
        /* dst starts inside src: copy from the end backwards. */
        d += n; s += n;
        while (n && ((uintptr_t)d & 7)) { *--d = *--s; n--; }
        for (; n >= 8; n -= 8) { d -= 8; s -= 8; *(u64u *)d = *(const u64u *)s; }
        while (n--) *--d = *--s;
    }
    return dst;
}`,
tests: String.raw`static uint8_t buf[256], ref[256];

static void ref_move(uint8_t *b, size_t d, size_t s, size_t n) {
    uint8_t tmp[256];
    for (size_t i = 0; i < n; i++) tmp[i] = b[s + i];
    for (size_t i = 0; i < n; i++) b[d + i] = tmp[i];
}

int main(void) {
    /* Every length up to 80 and every source and destination offset up to 23. */
    long cases = 0, bad = 0;
    for (size_t n = 0; n <= 80; n++)
        for (size_t s = 0; s < 24; s++)
            for (size_t d = 0; d < 24; d++) {
                for (int i = 0; i < 256; i++) buf[i] = ref[i] = (uint8_t)(i * 7 + 1);
                ref_move(ref, 64 + d, 64 + s, n);
                void *r = my_memmove(buf + 64 + d, buf + 64 + s, n);
                cases++;
                int same = r == buf + 64 + d;
                for (int i = 0; i < 256 && same; i++) same = buf[i] == ref[i];
                if (!same) bad++;
            }
    CHECK(bad == 0, "%ld of %ld cases were wrong (wrong bytes, or writes outside the destination)", bad, cases);

    /* A large overlapping move in each direction. */
    size_t big = 1 << 20;
    uint8_t *m = malloc(big + 4096);
    for (size_t i = 0; i < big + 4096; i++) m[i] = (uint8_t)(i % 251);
    my_memmove(m + 3, m, big);
    int ok = 1;
    for (size_t i = 0; i < big && ok; i++) ok = m[3 + i] == (uint8_t)(i % 251);
    CHECK(ok, "moving 1 MiB up by 3 bytes went wrong");
    for (size_t i = 0; i < big + 4096; i++) m[i] = (uint8_t)(i % 251);
    my_memmove(m, m + 1001, big);
    for (size_t i = 0; i < big && ok; i++) ok = m[i] == (uint8_t)((i + 1001) % 251);
    CHECK(ok, "moving 1 MiB down by 1001 bytes went wrong");
    free(m);
    return REPORT();
}`,
a: `<p>The direction test is one unsigned comparison: <code>d − s &lt; n</code> (as unsigned integers) is true exactly when the destination starts inside the source, which requires a backward copy. In every other case, including no overlap at all, forward is safe.</p>
<p>Then the three phases, mirrored for the backward copy: single bytes until the destination is 8-aligned, 8-byte words, and the leftover bytes. Aligning the destination rather than the source matters because misaligned stores that split a cache line are more expensive than misaligned loads on most cores. The source may still be misaligned, which is why the word type is declared <code>aligned(1)</code>: that tells the compiler not to assume alignment. <code>may_alias</code> keeps the word accesses legal under strict aliasing. Reading 8 bytes at a time is safe in the backward direction only because each word is read before any write overlaps it, which holds since the destination is above the source.</p>
<p>Production versions go much further: 32- or 64-byte vector loops, overlapping loads and stores for short copies (load the first and last 16 bytes and store both, which handles 16 to 32 bytes with no branches), <code>rep movsb</code> on cores with fast string support, and streaming stores for large copies. The exhaustive offset and length check is what catches the off-by-one bugs these optimizations invite.</p>`
});

C("intv-design", "build", {
lvl: "hard",
q: `<p>Implement a PC-indexed stride prefetcher (a reference prediction table, Chen and Baer, 1995). The table is 64 entries, direct-mapped by <code>(pc &gt;&gt; 2) % 64</code>, and each entry holds the full PC as its tag, the last address, a stride, and a state. On each load:</p>
<ul>
<li><strong>Table miss:</strong> replace the entry with last = addr, stride = 0, state INIT.</li>
<li><strong>Table hit:</strong> the access is correct if addr − last equals the stored stride.
<ul>
<li>INIT: correct → STEADY, else → TRANSIENT and update the stride.</li>
<li>TRANSIENT: correct → STEADY, else → NOPRED and update the stride.</li>
<li>STEADY: correct → STEADY, else → INIT and keep the stride.</li>
<li>NOPRED: correct → TRANSIENT, else stay NOPRED and update the stride.</li>
</ul>
Then set last = addr.</li>
<li>If the entry is now STEADY, return a prefetch for addr + <code>distance</code> × stride. Otherwise return 0.</li>
</ul>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>

#define RPT 64
typedef enum { INIT, TRANSIENT, STEADY, NOPRED } rpt_state_t;`,
todo: String.raw`typedef struct {
    /* TODO */
    int distance;
} rpt_t;

void rpt_init(rpt_t *r, int distance) {
    /* TODO */
    r->distance = distance;
}

uint64_t rpt_access(rpt_t *r, uint64_t pc, uint64_t addr) {
    /* TODO */
    return 0;
}`,
impl: String.raw`typedef struct {
    uint64_t tag, last;
    int64_t stride;
    rpt_state_t st;
    int valid;
} rpt_entry_t;

typedef struct {
    rpt_entry_t e[RPT];
    int distance;
} rpt_t;

void rpt_init(rpt_t *r, int distance) {
    for (int i = 0; i < RPT; i++) r->e[i].valid = 0;
    r->distance = distance;
}

uint64_t rpt_access(rpt_t *r, uint64_t pc, uint64_t addr) {
    rpt_entry_t *e = &r->e[(pc >> 2) % RPT];
    if (!e->valid || e->tag != pc) {
        *e = (rpt_entry_t){ pc, addr, 0, INIT, 1 };
        return 0;
    }
    int64_t delta = (int64_t)(addr - e->last);
    int correct = delta == e->stride;
    switch (e->st) {
    case INIT:      e->st = correct ? STEADY : TRANSIENT; break;
    case TRANSIENT: e->st = correct ? STEADY : NOPRED; break;
    case STEADY:    e->st = correct ? STEADY : INIT; break;
    case NOPRED:    e->st = correct ? TRANSIENT : NOPRED; break;
    }
    if (!correct && e->st != INIT) e->stride = delta;   /* STEADY to INIT keeps it */
    e->last = addr;
    return e->st == STEADY ? addr + (uint64_t)(r->distance * e->stride) : 0;
}`,
tests: String.raw`int main(void) {
    rpt_t r;
    rpt_init(&r, 4);

    /* A stream with a 64-byte stride: prefetches start on the third access. */
    uint64_t p[5];
    for (int i = 0; i < 5; i++) p[i] = rpt_access(&r, 0x401000, 0x10000 + 64 * i);
    CHECK(p[0] == 0 && p[1] == 0 && p[2] == 0x10080 + 4 * 64 && p[4] == 0x10100 + 256,
          "stream: prefetches %llx %llx %llx", (unsigned long long)p[1], (unsigned long long)p[2], (unsigned long long)p[4]);

    /* One irregular access drops STEADY to INIT but keeps the stride, so
       the stream resumes prefetching right away. */
    rpt_access(&r, 0x401000, 0x50000);                      /* STEADY -> INIT */
    uint64_t q = rpt_access(&r, 0x401000, 0x50000 + 64);    /* correct: INIT -> STEADY */
    CHECK(q == 0x50040 + 256, "after one glitch: prefetch %llx, expected 50140", (unsigned long long)q);

    /* Negative stride (a backwards loop). */
    rpt_init(&r, 1);
    uint64_t last = 0;
    for (int i = 0; i < 4; i++) last = rpt_access(&r, 0x402000, 0x90000 - 8 * i);
    CHECK(last == 0x90000 - 32, "backwards stride: %llx, expected 8FFE0", (unsigned long long)last);

    /* A pointer chase never settles. */
    rpt_init(&r, 4);
    srand(2);
    int issued = 0;
    for (int i = 0; i < 1000; i++) issued += rpt_access(&r, 0x403000, (uint64_t)rand() * 64) != 0;
    CHECK(issued == 0, "random addresses issued %d prefetches", issued);

    /* Two PCs with different strides in different entries don't interfere,
       but two PCs that map to the same entry thrash it. */
    rpt_init(&r, 1);
    int a = 0, b = 0;
    for (int i = 0; i < 100; i++) {
        a += rpt_access(&r, 0x404000, 0x100000 + 64 * i) != 0;
        b += rpt_access(&r, 0x404004, 0x200000 + 128 * i) != 0;
    }
    CHECK(a == 98 && b == 98, "separate entries: %d and %d prefetches, expected 98 each", a, b);
    rpt_init(&r, 1);
    a = 0;
    for (int i = 0; i < 100; i++) {
        a += rpt_access(&r, 0x404000, 0x100000 + 64 * i) != 0;
        a += rpt_access(&r, 0x404000 + 4 * RPT, 0x200000 + 128 * i) != 0;
    }
    CHECK(a == 0, "aliasing PCs: %d prefetches, expected 0", a);
    return REPORT();
}`,
a: `<p>The state machine is a confidence filter: one matching stride is enough to start prefetching (INIT to STEADY), one mismatch in STEADY drops to INIT but keeps the stride, so a stream that skips once resumes on the next access. Two mismatches in a row make the entry relearn. NOPRED keeps irregular loads, such as pointer chasing, from ever issuing prefetches, which protects cache capacity and bandwidth.</p>
<p>Points an interviewer will probe:</p>
<ul>
<li><strong>Distance:</strong> prefetch far enough ahead to cover the latency. With a load every few cycles and DRAM at 400 cycles, distance must be tens of strides, which is why real prefetchers ramp it up as confidence grows.</li>
<li><strong>Indexing by PC</strong> separates interleaved streams that an address-only prefetcher would mix up. The cost is the aliasing in the last check, where two loads map to one direct-mapped entry and destroy each other’s state.</li>
<li><strong>Training on misses only</strong> versus every access, and filtering prefetches that hit, are design choices that change accuracy and coverage. Measure both, plus the extra bandwidth.</li>
</ul>`
});

C("intv-design", "spend", {
lvl: "hard",
q: `<p>Implement Dynamic Insertion Policy with set dueling (Qureshi et al., 2007) for a 1,024-set, 16-way cache with 64-byte lines (a 1 MB L2-sized cache).</p>
<ul>
<li><strong>LRU insertion:</strong> a new line becomes most recently used. <strong>BIP:</strong> a new line goes in the LRU position, except every 32nd BIP insertion (a counter, so runs are deterministic), which goes in as MRU. Hits always move the line to MRU.</li>
<li><strong>Leaders:</strong> sets with <code>set % 32 == 0</code> always use LRU, and <code>set % 32 == 1</code> always use BIP. A miss in an LRU leader increments a 10-bit saturating PSEL counter (0 to 1,023, starting at 512), and a miss in a BIP leader decrements it.</li>
<li><strong>Followers</strong> use BIP when PSEL ≥ 512, else LRU.</li>
</ul>
<p><code>policy</code> forces LRU (0), BIP (1), or runs DIP (2). Return 1 on a hit.</p>`,
head: String.raw`#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define SETS 1024
#define WAYS 16
enum { LRU_ONLY, BIP_ONLY, DIP };`,
todo: String.raw`typedef struct {
    int policy;
    long hits, misses;
    int psel;   /* 0 to 1023 */
    /* TODO */
} cache_t;

void cache_init(cache_t *c, int policy) {
    memset(c, 0, sizeof *c);
    c->policy = policy;
    /* TODO */
}

int cache_access(cache_t *c, uint64_t addr) {
    /* TODO */
    return 0;
}`,
impl: String.raw`typedef struct {
    int policy;
    long hits, misses;
    uint64_t tag[SETS][WAYS];
    uint8_t valid[SETS][WAYS];
    uint32_t stamp[SETS][WAYS];   /* recency: larger is more recent */
    uint32_t clock;
    int psel, bip_count;
} cache_t;

void cache_init(cache_t *c, int policy) {
    memset(c, 0, sizeof *c);
    c->policy = policy;
    c->psel = 512;
    c->clock = 1;
}

int cache_access(cache_t *c, uint64_t addr) {
    uint64_t block = addr >> 6;
    int set = (int)(block % SETS);
    uint64_t tag = block / SETS;
    c->clock++;
    int victim = 0;
    for (int w = 0; w < WAYS; w++) {
        if (c->valid[set][w] && c->tag[set][w] == tag) {
            c->stamp[set][w] = c->clock;
            c->hits++;
            return 1;
        }
        if (!c->valid[set][w] ? c->valid[set][victim] : (c->valid[set][victim] && c->stamp[set][w] < c->stamp[set][victim]))
            victim = w;
    }
    c->misses++;
    int bip;
    if (c->policy != DIP) bip = c->policy == BIP_ONLY;
    else if (set % 32 == 0) { bip = 0; if (c->psel < 1023) c->psel++; }
    else if (set % 32 == 1) { bip = 1; if (c->psel > 0) c->psel--; }
    else bip = c->psel >= 512;
    int mru = !bip || (++c->bip_count % 32 == 0);
    c->tag[set][victim] = tag;
    c->valid[set][victim] = 1;
    /* LRU position: older than every line in the set (stamp 0). */
    c->stamp[set][victim] = mru ? c->clock : 0;
    return 0;
}`,
tests: String.raw`static cache_t c;

static double run(int policy, uint64_t footprint, int passes) {
    cache_init(&c, policy);
    for (int p = 0; p < passes; p++)
        for (uint64_t a = 0; a < footprint; a += 64) cache_access(&c, a);
    return (double)c.hits / (c.hits + c.misses);
}

int main(void) {
    const uint64_t MB = 1 << 20;
    /* Fits: every policy hits after the first pass. */
    double l = run(LRU_ONLY, MB / 2, 10), b = run(BIP_ONLY, MB / 2, 10), d = run(DIP, MB / 2, 10);
    CHECK(l == 0.9 && b == 0.9 && d == 0.9, "512 KB loop: LRU %.3f BIP %.3f DIP %.3f, expected 0.9 each", l, b, d);

    /* 1.25 MB loop: LRU thrashes completely, BIP keeps most of the cache. */
    l = run(LRU_ONLY, MB + MB / 4, 20);
    b = run(BIP_ONLY, MB + MB / 4, 20);
    d = run(DIP, MB + MB / 4, 20);
    CHECK(l == 0.0, "1.25 MB loop with LRU: hit rate %.3f, expected 0", l);
    CHECK(b > 0.6, "1.25 MB loop with BIP: hit rate %.3f, expected above 0.6", b);
    CHECK(d > 0.55 && d < b + 0.02, "DIP should approach BIP: %.3f vs %.3f", d, b);
    CHECK(c.psel >= 512, "PSEL ended at %d: the duel should pick BIP", c.psel);
    return REPORT();
}`,
a: `<p>Represent recency with timestamps. Inserting at the LRU position is a stamp of 0, older than anything in the set, so the next miss in that set evicts the new line again unless it gets a hit first. That is BIP’s point: on a loop larger than the cache, LRU evicts each line just before it would be reused and gets zero hits, while BIP leaves most of the old lines alone. The occasional MRU insertion lets the resident set adapt slowly when the working set changes.</p>
<p>Set dueling lets the hardware run the experiment itself. A few leader sets (32 of each here, about 6% of the cache) always use one policy, a single counter tracks which leader group misses less, and the remaining 960 sets follow the winner. The overhead is one 10-bit counter for the whole cache.</p>
<p>In the checks, a 512 KB loop fits, so after the first pass everything hits under any policy (90% over 10 passes). On the 1.25 MB loop LRU gets nothing. BIP keeps 15 of the 20 lines that map to each set once warm, 71% hits over 20 passes. DIP gets 69%, losing a little in the LRU leader sets and while the duel settles. This line of work led to RRIP, the re-reference interval prediction family used in recent Intel last-level caches.</p>`
});
})();
