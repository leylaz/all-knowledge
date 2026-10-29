/* Compiles and runs C in the browser for the Coding tab of interview pages
   (public repo only: the artifact is published without coding/).
   Clang 21 (YoWASP's WebAssembly build) compiles to wasm32-wasip1, and a
   small WASI layer below runs the result, printing stdout and stderr.
   Problems marked `threads` link sim_rt.c and force-include sim.h, which
   map pthreads and C11/GCC atomics onto simulated threads: Binaryen's
   Asyncify pass lets the scheduler below switch threads at every atomic
   operation, lock call, and sched_yield(), picking switches from a seeded
   random generator so a schedule can be replayed. Memory is sequentially
   consistent. cEngine() is self-contained so it can be stringified into a
   Worker. Nothing here touches the DOM, so tools/check.js can load it. */
const CRUN_URLS = {
  clang: "https://cdn.jsdelivr.net/npm/@yowasp/clang@21.1.4-3/gen/bundle.js",
  binaryen: "https://cdn.jsdelivr.net/npm/binaryen@131.0.0/index.js"
};

const SIM_H = String.raw`#pragma once
/* Simulated threads: every thread runs on one core, and the scheduler may
   switch threads at each atomic operation, lock call, or sched_yield(). */
#include <pthread.h>
#include <stdatomic.h>
#include <sched.h>
#include <stdint.h>

__attribute__((import_module("env"), import_name("sim_yield"))) void __sim_yield(int kind);
int __sim_create(pthread_t *, const pthread_attr_t *, void *(*)(void *), void *);
int __sim_join(pthread_t, void **);
pthread_t __sim_self(void);
int __sim_mutex_init(pthread_mutex_t *, const pthread_mutexattr_t *);
int __sim_mutex_lock(pthread_mutex_t *);
int __sim_mutex_trylock(pthread_mutex_t *);
int __sim_mutex_unlock(pthread_mutex_t *);
int __sim_cond_init(pthread_cond_t *, const pthread_condattr_t *);
int __sim_cond_wait(pthread_cond_t *, pthread_mutex_t *);
int __sim_cond_signal(pthread_cond_t *);
int __sim_barrier_init(pthread_barrier_t *, const pthread_barrierattr_t *, unsigned);
int __sim_barrier_wait(pthread_barrier_t *);
int __sim_nop(void *);
int __sim_sched_yield(void);

#define pthread_create __sim_create
#define pthread_join __sim_join
#define pthread_self __sim_self
#define pthread_mutex_init __sim_mutex_init
#define pthread_mutex_lock __sim_mutex_lock
#define pthread_mutex_trylock __sim_mutex_trylock
#define pthread_mutex_unlock __sim_mutex_unlock
#define pthread_mutex_destroy(m) __sim_nop(m)
#define pthread_cond_init __sim_cond_init
#define pthread_cond_wait __sim_cond_wait
#define pthread_cond_signal __sim_cond_signal
#define pthread_cond_broadcast __sim_cond_signal
#define pthread_cond_destroy(c) __sim_nop(c)
#define pthread_barrier_init __sim_barrier_init
#define pthread_barrier_wait __sim_barrier_wait
#define pthread_barrier_destroy(b) __sim_nop(b)
#define sched_yield __sim_sched_yield

#define __SIM_Y(e) (__sim_yield(0), e)
#undef atomic_store
#undef atomic_store_explicit
#undef atomic_load
#undef atomic_load_explicit
#undef atomic_exchange
#undef atomic_exchange_explicit
#undef atomic_compare_exchange_strong
#undef atomic_compare_exchange_strong_explicit
#undef atomic_compare_exchange_weak
#undef atomic_compare_exchange_weak_explicit
#undef atomic_fetch_add
#undef atomic_fetch_add_explicit
#undef atomic_fetch_sub
#undef atomic_fetch_sub_explicit
#undef atomic_fetch_or
#undef atomic_fetch_or_explicit
#undef atomic_fetch_xor
#undef atomic_fetch_xor_explicit
#undef atomic_fetch_and
#undef atomic_fetch_and_explicit
#undef atomic_flag_test_and_set
#undef atomic_flag_test_and_set_explicit
#undef atomic_flag_clear
#undef atomic_flag_clear_explicit
#undef atomic_thread_fence
#define atomic_store(o, v) __SIM_Y(__c11_atomic_store(o, v, __ATOMIC_SEQ_CST))
#define atomic_store_explicit(o, v, m) __SIM_Y(__c11_atomic_store(o, v, m))
#define atomic_load(o) __SIM_Y(__c11_atomic_load(o, __ATOMIC_SEQ_CST))
#define atomic_load_explicit(o, m) __SIM_Y(__c11_atomic_load(o, m))
#define atomic_exchange(o, v) __SIM_Y(__c11_atomic_exchange(o, v, __ATOMIC_SEQ_CST))
#define atomic_exchange_explicit(o, v, m) __SIM_Y(__c11_atomic_exchange(o, v, m))
#define atomic_compare_exchange_strong(o, e, v) __SIM_Y(__c11_atomic_compare_exchange_strong(o, e, v, __ATOMIC_SEQ_CST, __ATOMIC_SEQ_CST))
#define atomic_compare_exchange_strong_explicit(o, e, v, s, f) __SIM_Y(__c11_atomic_compare_exchange_strong(o, e, v, s, f))
#define atomic_compare_exchange_weak(o, e, v) __SIM_Y(__c11_atomic_compare_exchange_weak(o, e, v, __ATOMIC_SEQ_CST, __ATOMIC_SEQ_CST))
#define atomic_compare_exchange_weak_explicit(o, e, v, s, f) __SIM_Y(__c11_atomic_compare_exchange_weak(o, e, v, s, f))
#define atomic_fetch_add(o, v) __SIM_Y(__c11_atomic_fetch_add(o, v, __ATOMIC_SEQ_CST))
#define atomic_fetch_add_explicit(o, v, m) __SIM_Y(__c11_atomic_fetch_add(o, v, m))
#define atomic_fetch_sub(o, v) __SIM_Y(__c11_atomic_fetch_sub(o, v, __ATOMIC_SEQ_CST))
#define atomic_fetch_sub_explicit(o, v, m) __SIM_Y(__c11_atomic_fetch_sub(o, v, m))
#define atomic_fetch_or(o, v) __SIM_Y(__c11_atomic_fetch_or(o, v, __ATOMIC_SEQ_CST))
#define atomic_fetch_or_explicit(o, v, m) __SIM_Y(__c11_atomic_fetch_or(o, v, m))
#define atomic_fetch_xor(o, v) __SIM_Y(__c11_atomic_fetch_xor(o, v, __ATOMIC_SEQ_CST))
#define atomic_fetch_xor_explicit(o, v, m) __SIM_Y(__c11_atomic_fetch_xor(o, v, m))
#define atomic_fetch_and(o, v) __SIM_Y(__c11_atomic_fetch_and(o, v, __ATOMIC_SEQ_CST))
#define atomic_fetch_and_explicit(o, v, m) __SIM_Y(__c11_atomic_fetch_and(o, v, m))
#define atomic_flag_test_and_set(o) __SIM_Y(__c11_atomic_exchange(&(o)->_Value, 1, __ATOMIC_SEQ_CST))
#define atomic_flag_test_and_set_explicit(o, m) __SIM_Y(__c11_atomic_exchange(&(o)->_Value, 1, m))
#define atomic_flag_clear(o) __SIM_Y(__c11_atomic_store(&(o)->_Value, 0, __ATOMIC_SEQ_CST))
#define atomic_flag_clear_explicit(o, m) __SIM_Y(__c11_atomic_store(&(o)->_Value, 0, m))
#define atomic_thread_fence(m) __sim_yield(0)
#define __atomic_load_n(...) __SIM_Y(__atomic_load_n(__VA_ARGS__))
#define __atomic_store_n(...) __SIM_Y(__atomic_store_n(__VA_ARGS__))
#define __atomic_exchange_n(...) __SIM_Y(__atomic_exchange_n(__VA_ARGS__))
#define __atomic_compare_exchange_n(...) __SIM_Y(__atomic_compare_exchange_n(__VA_ARGS__))
#define __atomic_fetch_add(...) __SIM_Y(__atomic_fetch_add(__VA_ARGS__))
#define __atomic_fetch_sub(...) __SIM_Y(__atomic_fetch_sub(__VA_ARGS__))
#define __atomic_add_fetch(...) __SIM_Y(__atomic_add_fetch(__VA_ARGS__))
#define __atomic_sub_fetch(...) __SIM_Y(__atomic_sub_fetch(__VA_ARGS__))
#define __atomic_fetch_or(...) __SIM_Y(__atomic_fetch_or(__VA_ARGS__))
#define __atomic_fetch_and(...) __SIM_Y(__atomic_fetch_and(__VA_ARGS__))
#define __atomic_test_and_set(...) __SIM_Y(__atomic_test_and_set(__VA_ARGS__))
#define __atomic_clear(...) __SIM_Y(__atomic_clear(__VA_ARGS__))
#define __atomic_thread_fence(m) __sim_yield(0)
#define __sync_fetch_and_add(...) __SIM_Y(__sync_fetch_and_add(__VA_ARGS__))
#define __sync_fetch_and_sub(...) __SIM_Y(__sync_fetch_and_sub(__VA_ARGS__))
#define __sync_add_and_fetch(...) __SIM_Y(__sync_add_and_fetch(__VA_ARGS__))
#define __sync_sub_and_fetch(...) __SIM_Y(__sync_sub_and_fetch(__VA_ARGS__))
#define __sync_val_compare_and_swap(...) __SIM_Y(__sync_val_compare_and_swap(__VA_ARGS__))
#define __sync_bool_compare_and_swap(...) __SIM_Y(__sync_bool_compare_and_swap(__VA_ARGS__))
#define __sync_lock_test_and_set(...) __SIM_Y(__sync_lock_test_and_set(__VA_ARGS__))
#define __sync_lock_release(...) __SIM_Y(__sync_lock_release(__VA_ARGS__))
#define __sync_synchronize() __sim_yield(0)
`;

const SIM_RT = String.raw`#include "sim.h"
#include <stdlib.h>
#include <errno.h>

#define MAXT 256
#define STACK (256 * 1024)
#define ABUF (64 * 1024)

__attribute__((import_module("env"), import_name("sim_spawn"))) void sim_spawn(int id, void *stack_top, void *abuf, int asize);
__attribute__((import_module("env"), import_name("sim_self"))) int sim_self(void);

static struct { void *(*fn)(void *); void *arg, *ret; volatile int done, used; } T[MAXT];
static char main_abuf[ABUF];

__attribute__((export_name("sim_main_abuf"))) void *sim_main_abuf(void) { return main_abuf; }
__attribute__((export_name("sim_abuf_size"))) int sim_abuf_size(void) { return ABUF; }
__attribute__((export_name("sim_run"))) void sim_run(int id) {
  T[id].ret = T[id].fn(T[id].arg);
  T[id].done = 1;
}

/* Kinds of yield: 0 may switch, 1 always switches (sched_yield), 2 always
   switches and means "blocked", for deadlock detection. */
int __sim_create(pthread_t *t, const pthread_attr_t *a, void *(*fn)(void *), void *arg) {
  (void)a;
  int id = 1;
  while (id < MAXT && T[id].used) id++;
  if (id == MAXT) return EAGAIN;
  char *stack = malloc(STACK), *abuf = malloc(ABUF);
  if (!stack || !abuf) return EAGAIN;
  T[id].fn = fn; T[id].arg = arg; T[id].done = 0; T[id].used = 1;
  sim_spawn(id, (void *)(((uintptr_t)stack + STACK) & ~(uintptr_t)15), abuf, ABUF);
  *t = (pthread_t)(uintptr_t)id;
  __sim_yield(0);
  return 0;
}
int __sim_join(pthread_t t, void **ret) {
  int id = (int)(uintptr_t)t;
  if (id <= 0 || id >= MAXT || !T[id].used) return ESRCH;
  while (!T[id].done) __sim_yield(2);
  if (ret) *ret = T[id].ret;
  return 0;
}
pthread_t __sim_self(void) { return (pthread_t)(uintptr_t)sim_self(); }
int __sim_nop(void *p) { (void)p; return 0; }
int __sim_sched_yield(void) { __sim_yield(1); return 0; }

/* Word 0 of a mutex is its lock bit. Word 0 of a condition variable counts
   wakeups. A barrier keeps its count, arrivals, and generation. */
int __sim_mutex_init(pthread_mutex_t *m, const pthread_mutexattr_t *a) { (void)a; m->__u.__vi[0] = 0; return 0; }
int __sim_mutex_lock(pthread_mutex_t *m) {
  __sim_yield(0);
  while (m->__u.__vi[0]) __sim_yield(2);
  m->__u.__vi[0] = 1;
  return 0;
}
int __sim_mutex_trylock(pthread_mutex_t *m) {
  __sim_yield(0);
  if (m->__u.__vi[0]) return EBUSY;
  m->__u.__vi[0] = 1;
  return 0;
}
int __sim_mutex_unlock(pthread_mutex_t *m) { m->__u.__vi[0] = 0; __sim_yield(0); return 0; }
int __sim_cond_init(pthread_cond_t *c, const pthread_condattr_t *a) { (void)a; c->__u.__vi[0] = 0; return 0; }
int __sim_cond_wait(pthread_cond_t *c, pthread_mutex_t *m) {
  int seq = c->__u.__vi[0];
  __sim_mutex_unlock(m);
  while (seq == c->__u.__vi[0]) __sim_yield(2);
  return __sim_mutex_lock(m);
}
int __sim_cond_signal(pthread_cond_t *c) { c->__u.__vi[0]++; __sim_yield(0); return 0; }
int __sim_barrier_init(pthread_barrier_t *b, const pthread_barrierattr_t *a, unsigned n) {
  (void)a;
  if (!n) return EINVAL;
  b->__u.__vi[0] = (int)n; b->__u.__vi[1] = 0; b->__u.__vi[2] = 0;
  return 0;
}
int __sim_barrier_wait(pthread_barrier_t *b) {
  __sim_yield(0);
  int gen = b->__u.__vi[2];
  if (++b->__u.__vi[1] == b->__u.__vi[0]) {
    b->__u.__vi[1] = 0; b->__u.__vi[2]++;
    return PTHREAD_BARRIER_SERIAL_THREAD;
  }
  while (gen == b->__u.__vi[2]) __sim_yield(2);
  return 0;
}
`;

/* The engine: compile(src, threads) resolves the wasm bytes or throws
   {diag}, and run(wasm, opts) resolves the exit status. `post(type, data)`
   reports progress ("status"), program output ("out", "err"), and compiler
   diagnostics ("diag"). */
function cEngine(cfg, post) {
  let clangP = null, binP = null, loaded = false;
  const MAX_OUT = 64 * 1024, MAX_STEPS = 20e6, MAX_MS = 15000;
  async function compile(src, threads) {
    if (!clangP) { post("status", "Loading the compiler..."); clangP = import(cfg.clang); }
    const { runClang } = await clangP.catch(e => { clangP = null; throw e; });
    if (threads && !binP) binP = import(cfg.binaryen);
    post("status", "Compiling...");
    const files = { "main.c": src };
    const args = ["clang", "-O2", "-std=gnu17", "-Wall", "-Wextra", "-Wno-missing-field-initializers", "-Wno-unused-parameter", "-Wno-unused-function", "-fno-color-diagnostics",
      "-D_WASI_EMULATED_PROCESS_CLOCKS", "-D_WASI_EMULATED_SIGNAL", "-D_WASI_EMULATED_MMAN",
      "-Wl,-z,stack-size=1048576", "-o", "main.wasm"];
    if (threads) { Object.assign(files, { "sim.h": cfg.simH, "sim_rt.c": cfg.simRt }); args.push("-include", "sim.h", "main.c", "sim_rt.c"); }
    else args.push("main.c");
    args.push("-lm", "-lwasi-emulated-process-clocks", "-lwasi-emulated-signal", "-lwasi-emulated-mman");
    let diag = "";
    const td = new TextDecoder();
    const sink = b => { if (b) diag += td.decode(b, { stream: true }); };
    let out;
    let shown = -1;
    const fetchProgress = ({ totalLength, doneLength }) => {
      const pct = Math.floor(100 * doneLength / totalLength);
      if (loaded || pct === shown) return;
      shown = pct;
      post("status", pct < 100 ? `Loading the compiler: ${pct}%` : "Compiling...");
    };
    try { out = await runClang(args, files, { stdout: sink, stderr: sink, fetchProgress }); loaded = true; }
    catch (e) { const err = new Error("compile failed"); err.diag = diag || String(e && e.message || e); throw err; }
    if (diag) post("diag", diag);
    let wasm = out["main.wasm"];
    if (threads) {
      post("status", "Preparing simulated threads...");
      const b = (await binP.catch(e => { binP = null; throw e; })).default;
      const mod = b.readBinary(wasm);
      mod.setFeatures(b.Features.All);
      b.setPassArgument("asyncify-imports", "env.sim_yield");
      b.setOptimizeLevel(1);
      mod.runPasses(["asyncify"]);
      mod.optimize();
      /* wasm-ld always makes the stack pointer global 0. */
      mod.addGlobalExport(b.getGlobalInfo(mod.getGlobalByIndex(0)).name, "__sim_sp");
      wasm = mod.emitBinary();
      mod.dispose();
    }
    return wasm;
  }

  async function run(wasm, opts) {
    const seed = opts.seed >>> 0, threads = !!opts.threads;
    let rng = seed || 1;
    const rand = () => { rng = (rng + 0x6D2B79F5) | 0; let t = Math.imul(rng ^ (rng >>> 15), 1 | rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const module = await WebAssembly.compile(wasm);
    let ex, mem, outBytes = 0;
    class Exit { constructor(code) { this.code = code; } }
    class Stop { constructor(msg) { this.msg = msg; } }
    const td = [new TextDecoder(), new TextDecoder()];
    const dv = () => new DataView(mem.buffer);
    const t0 = Date.now();
    const ERR = { badf: 8, inval: 28, nosys: 52, spipe: 70 };
    const wasi = {
      args_sizes_get(argc, size) { dv().setUint32(argc, 1, true); dv().setUint32(size, 5, true); return 0; },
      args_get(argv, buf) { dv().setUint32(argv, buf, true); new Uint8Array(mem.buffer, buf, 5).set([109, 97, 105, 110, 0]); return 0; },
      environ_sizes_get(n, size) { dv().setUint32(n, 0, true); dv().setUint32(size, 0, true); return 0; },
      environ_get() { return 0; },
      clock_res_get(id, out) { dv().setBigUint64(out, 1000n, true); return 0; },
      clock_time_get(id, prec, out) {
        const ms = id === 0 ? Date.now() : performance.now();
        dv().setBigUint64(out, BigInt(Math.round(ms * 1e6)), true); return 0;
      },
      fd_write(fd, iovs, n, written) {
        if (fd !== 1 && fd !== 2) return ERR.badf;
        let total = 0, text = "";
        for (let i = 0; i < n; i++) {
          const p = dv().getUint32(iovs + 8 * i, true), len = dv().getUint32(iovs + 8 * i + 4, true);
          text += td[fd - 1].decode(new Uint8Array(mem.buffer, p, len), { stream: true });
          total += len;
        }
        dv().setUint32(written, total, true);
        outBytes += total;
        post(fd === 1 ? "out" : "err", text);
        if (outBytes > MAX_OUT) throw new Stop("Stopped: the program printed more than 64 KB.");
        return 0;
      },
      fd_read(fd, iovs, n, nread) { if (fd !== 0) return ERR.badf; dv().setUint32(nread, 0, true); return 0; },
      fd_close() { return 0; },
      fd_seek(fd) { return fd <= 2 ? ERR.spipe : ERR.badf; },
      fd_fdstat_get(fd, out) {
        if (fd > 2) return ERR.badf;
        const d = dv();
        d.setUint8(out, 2); d.setUint16(out + 2, 0, true);
        /* Seek and tell rights cleared, so isatty() is true and stdout is line-buffered. */
        d.setBigUint64(out + 8, 0xFFFFFFFFFFFFFFDBn, true); d.setBigUint64(out + 16, 0xFFFFFFFFFFFFFFDBn, true);
        return 0;
      },
      fd_prestat_get() { return ERR.badf; },
      random_get(buf, len) { const a = new Uint8Array(mem.buffer, buf, len); for (let i = 0; i < len; i++) a[i] = (rand() * 256) | 0; return 0; },
      sched_yield() { return 0; },
      proc_exit(code) { throw new Exit(code); }
    };

    /* Simulated threads. Thread 0 is main, entered through _start. Each
       other thread has its own C stack and Asyncify buffer, allocated by
       sim_rt.c. A switch unwinds the running thread's wasm stack into its
       buffer, and resuming rewinds it by calling the same export again. */
    const T = new Map();
    let cur = null, next = null, steps = 0, blocked = 0;
    const env = {
      sim_spawn(id, top, abuf, asize) { T.set(id, { id, sp: top, abuf, asize, started: false, done: false }); },
      sim_self() { return cur ? cur.id : 0; },
      sim_yield(kind) {
        if (ex.asyncify_get_state() === 2) { ex.asyncify_stop_rewind(); return; }
        if (++steps > MAX_STEPS) throw new Stop("Stopped after 20 million scheduling points: a livelock, or a spin that never ends?");
        if ((steps & 4095) === 0 && Date.now() - t0 > MAX_MS) throw new Stop("Stopped: the program ran for more than 15 s.");
        const live = [...T.values()].filter(t => !t.done && t !== cur);
        if (kind === 2) { if (++blocked > 5000 * (live.length + 1)) throw new Stop("Deadlock: every thread is waiting on a lock, join, condition, or barrier."); }
        else blocked = 0;
        if (!live.length || (kind === 0 && rand() >= 0.25)) return;
        next = live[(rand() * live.length) | 0];
        const d = dv();
        d.setUint32(cur.abuf, cur.abuf + 8, true); d.setUint32(cur.abuf + 4, cur.abuf + cur.asize, true);
        ex.asyncify_start_unwind(cur.abuf);
      }
    };

    const imports = { wasi_snapshot_preview1: {}, env: {} };
    for (const imp of WebAssembly.Module.imports(module)) {
      if (imp.kind !== "function") continue;
      const table = imp.module === "env" ? env : wasi;
      imports[imp.module] = imports[imp.module] || {};
      imports[imp.module][imp.name] = table[imp.name] || (() => ERR.nosys);
    }
    const inst = await WebAssembly.instantiate(module, imports);
    ex = inst.exports; mem = ex.memory;

    const finish = (status, msg) => ({ status, msg, ms: Date.now() - t0 });
    try {
      if (!threads) { ex._start(); return finish(0); }
      T.set(0, { id: 0, abuf: ex.sim_main_abuf(), asize: ex.sim_abuf_size(), started: false, done: false });
      next = T.get(0);
      while (next) {
        const t = cur = next; next = null;
        if (t.started) { ex.__sim_sp.value = t.sp; ex.asyncify_start_rewind(t.abuf); }
        else { t.started = true; if (t.id) ex.__sim_sp.value = t.sp; }
        if (t.id) ex.sim_run(t.id); else ex._start();
        if (ex.asyncify_get_state() === 1) { ex.asyncify_stop_unwind(); t.sp = ex.__sim_sp.value; continue; }
        t.done = true;
        const live = [...T.values()].filter(u => !u.done);
        next = live.length ? live[(rand() * live.length) | 0] : null;
      }
      return finish(0);
    } catch (e) {
      if (e instanceof Exit) return finish(e.code);
      if (e instanceof Stop) return finish(-1, e.msg);
      if (e instanceof WebAssembly.RuntimeError) {
        const m = String(e.message);
        const why = /unreachable/.test(m) ? "abort() was called, or the program trapped (unreachable)"
          : /out of bounds/.test(m) ? "memory access out of bounds (a bad pointer or index)"
          : /call stack|stack overflow|too much recursion/i.test(m) ? "stack overflow (runaway recursion?)"
          : /divide by zero|integer overflow/.test(m) ? "integer divide by zero or overflow" : m;
        return finish(-1, "Runtime error: " + why + ".");
      }
      throw e;
    }
  }

  return { compile, run };
}

/* Worker body: one engine per worker, kept between runs so the compiler
   loads once. */
function cWorkerMain(scope, cfg) {
  let job = 0;
  const eng = cEngine(cfg, (type, data) => scope.postMessage({ id: job, type, data }));
  scope.onmessage = async e => {
    const m = e.data;
    job = m.id;
    try {
      const wasm = await eng.compile(m.src, m.threads);
      scope.postMessage({ id: m.id, type: "status", data: "Running..." });
      const res = await eng.run(wasm, m);
      scope.postMessage({ id: m.id, type: "done", data: res });
    } catch (err) {
      scope.postMessage({ id: m.id, type: "fail", data: err.diag ? { diag: err.diag } : { msg: String(err && err.message || err) } });
    }
  };
}

/* Page side: CRUN.run(src, {threads, seed}, onEvent) runs one program and
   reports the worker's events. The engine runs in a Worker so a program
   that never ends can be stopped. If the host blocks workers, it runs on
   the page instead, where only the threads scheduler's 15 s limit applies. */
const CRUN = (function () {
  const cfg = () => Object.assign({ simH: SIM_H, simRt: SIM_RT }, CRUN_URLS);
  const RUN_MS = 20000;
  let worker = null, inline = null, job = null, seq = 0, timer = null;
  function dispatch(m) {
    if (!job || m.id !== job.id) return;
    if (m.type === "status" && m.data === "Running..." && worker) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        worker.terminate(); worker = null;
        end({ type: "done", data: { status: -1, msg: "Stopped: the program ran for more than 20 s (an infinite loop?)." } });
      }, RUN_MS);
    }
    if (m.type === "done" || m.type === "fail") end(m); else job.cb(m.type, m.data);
  }
  function end(m) { clearTimeout(timer); const j = job; job = null; j.cb(m.type, m.data); }
  function useInline() {
    worker = null;
    if (!inline) { inline = { postMessage: d => setTimeout(() => dispatch(d)) }; cWorkerMain(inline, cfg()); }
  }
  function start() {
    if (worker || inline) return;
    try {
      const src = `${cEngine}\n${cWorkerMain}\ncWorkerMain(self, ${JSON.stringify(cfg())});`;
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      let heard = false;
      worker.onmessage = e => { heard = true; dispatch(e.data); };
      worker.onerror = e => {
        if (heard) return;
        e.preventDefault();
        useInline();
        if (job) inline.onmessage({ data: job.msg });
      };
    } catch (e) { useInline(); }
  }
  function run(src, opts, cb) {
    if (job) return false;
    start();
    const msg = { id: ++seq, src, threads: !!opts.threads, seed: opts.seed || 1 };
    job = { id: msg.id, msg, cb };
    if (worker) worker.postMessage(msg); else inline.onmessage({ data: msg });
    return true;
  }
  return { run, busy: () => !!job };
})();

if (typeof module !== "undefined") module.exports = { cEngine, cWorkerMain, SIM_H, SIM_RT, CRUN_URLS };
