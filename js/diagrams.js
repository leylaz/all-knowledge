/* Clickable diagrams: the 5-stage pipeline on the Pipeline Stages overview,
   and the chip floorplan and industry stack on the home page. Every link
   points at an existing note (and optionally a section anchor) by hash route. */

function svgEsc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

/* A clickable rectangle with centered label lines. kind: core | mem | io | ghost */
function fpBlock(x, y, w, h, href, lines, kind, tip) {
  const lh = 15, sub = lines.length > 1 ? lines.slice(1) : [];
  const total = lh + sub.length * 13;
  let ty = y + h / 2 - total / 2 + 11;
  const cx = x + w / 2;
  let t = `<text class="l" x="${cx}" y="${ty}">${svgEsc(lines[0])}</text>`;
  sub.forEach((s, i) => { t += `<text class="s" x="${cx}" y="${ty + 15 + i * 13}">${svgEsc(s)}</text>`; });
  const label = tip || lines.join(", ");
  return `<a href="#/${href}" class="fpb ${kind}" aria-label="${svgEsc(label)}"><title>${svgEsc(label)}</title>
    <rect class="b" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>${t}</a>`;
}

/* ---------- 5-stage pipeline ---------- */
function plStage(x, href, abbr, name, parts) {
  const cx = x + 59;
  return `<a href="#/${href}" class="fpb core" aria-label="${svgEsc(name)} (${abbr})"><title>${svgEsc(name)} (${abbr})</title>
    <rect class="b" x="${x}" y="110" width="118" height="130" rx="3"/>
    <text class="big" x="${cx}" y="142">${abbr}</text>
    <text class="s" x="${cx}" y="160">${svgEsc(name)}</text>
    ${parts.map((p, i) => `<text class="p" x="${cx}" y="${186 + i * 16}">${svgEsc(p)}</text>`).join("")}</a>`;
}
function plReg(x, name) {
  return `<a href="#/pipe-problems/pipe-regs" class="fpb preg" aria-label="${name} pipeline register"><title>${name} pipeline register</title>
    <rect class="b" x="${x}" y="96" width="12" height="160" rx="2"/>
    <text class="s" x="${x + 6}" y="272">${name}</text></a>`;
}
function plPath(href, d, cls, label, tip) {
  return `<a href="#/${href}" class="plp ${cls}" aria-label="${svgEsc(tip)}"><title>${svgEsc(tip)}</title>
    <path class="hit" d="${d}"/><path class="ln" d="${d}" marker-end="url(#ah-${cls})"/>${label}</a>`;
}

function pipelineSVG() {
  return `<figure class="fp-fig pl-fig">
  <div class="fp-scroll"><svg class="fp pl" viewBox="0 0 760 390" role="group" aria-label="Classic 5-stage pipeline. Stages, pipeline registers, forwarding paths, and the branch redirect link to their notes.">
    <defs>
      <marker id="ah-fwd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah fwd" d="M0,0 L10,5 L0,10 z"/></marker>
      <marker id="ah-redir" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah redir" d="M0,0 L10,5 L0,10 z"/></marker>
      <marker id="ah-aux" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah aux" d="M0,0 L10,5 L0,10 z"/></marker>
    </defs>

    ${plPath("branch-hazards/schemes", "M371,110 L371,58 L79,58 L79,106", "redir",
      `<text class="pl-lab redir" x="225" y="50">Branch redirect: target → PC, flush IF and ID</text>`,
      "Branch redirect: a taken or mispredicted branch resolved in EX sends its target to the PC and flushes the two younger instructions")}

    ${plStage(20, "stage-if", "IF", "Instruction fetch", ["PC → I-cache", "PC + 4"])}
    ${plReg(146, "IF/ID")}
    ${plStage(166, "stage-id", "ID", "Decode / reg read", ["Decode", "Register read", "Sign-extend"])}
    ${plReg(292, "ID/EX")}
    ${plStage(312, "stage-ex", "EX", "Execute / address", ["ALU", "Effective address", "Branch compare"])}
    ${plReg(438, "EX/MEM")}
    ${plStage(458, "stage-mem", "MEM", "Memory access", ["D-cache load", "D-cache store"])}
    ${plReg(584, "MEM/WB")}
    ${plStage(604, "stage-wb", "WB", "Write-back", ["Register write"])}

    ${plPath("data-hazards/forwarding", "M444,256 L444,300 L398,300 L398,244", "fwd",
      `<text class="pl-lab fwd" x="452" y="304" text-anchor="start">Forward EX/MEM → ALU</text>`,
      "Forwarding path: EX/MEM result back to the ALU input")}
    ${plPath("data-hazards/forwarding", "M590,256 L590,330 L344,330 L344,244", "fwd",
      `<text class="pl-lab fwd" x="598" y="334" text-anchor="start">Forward MEM/WB → ALU</text>`,
      "Forwarding path: MEM/WB result back to the ALU input")}

    ${fpBlock(20, 300, 118, 44, "branch-hazards/btb", ["Branch predictor", "+ BTB"], "core", "Branch-target buffer and dynamic prediction")}
    <path class="aux-ln" d="M79,300 L79,244" marker-end="url(#ah-aux)"/>
    ${fpBlock(166, 300, 118, 44, "data-hazards/load-use", ["Hazard detection", "load-use stall"], "core", "Hazard detection unit: load-use stall")}
    <path class="aux-ln" d="M225,300 L225,244" marker-end="url(#ah-aux)"/>

    <g class="pl-key" transform="translate(20,372)">
      <rect class="k-stage" x="0" y="-9" width="14" height="10" rx="2"/><text x="20" y="0">Stage</text>
      <rect class="k-reg" x="74" y="-9" width="14" height="10" rx="2"/><text x="94" y="0">Pipeline register</text>
      <line class="k-fwd" x1="214" y1="-4" x2="238" y2="-4"/><text x="244" y="0">Forwarding</text>
      <line class="k-redir" x1="330" y1="-4" x2="354" y2="-4"/><text x="360" y="0">Branch redirect</text>
      <text class="hint" x="720" y="0" text-anchor="end">Click any part</text>
    </g>
  </svg></div></figure>`;
}
