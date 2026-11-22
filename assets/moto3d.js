import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const T = window.TOPITO;               // { productos, add(id) }
const root = document.getElementById("v3d");
if (!root || !T) throw new Error("3D no disponible");
const canvasWrap = root.querySelector(".stage3d");
const card = root.querySelector(".pcard");
const chips = root.querySelector(".chips3d");
const dotsLayer = root.querySelector(".dots3d");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const byId = id => T.productos.find(p => p.id === id);

/* ---------- materiales ---------- */
const M = {
  black: new THREE.MeshStandardMaterial({ color: 0x23252d, roughness: .5, metalness: .35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x4a4f5c, roughness: .45, metalness: .55 }),
  red: new THREE.MeshStandardMaterial({ color: 0xd0182b, roughness: .32, metalness: .35 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xb9c0cc, roughness: .28, metalness: .9 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9a21b, roughness: .3, metalness: .85 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: .95, metalness: 0 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .4, metalness: .1 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c4, emissiveIntensity: 1.3, roughness: .2 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fb6c9, roughness: .1, metalness: .6 }),
  green: new THREE.MeshStandardMaterial({ color: 0x1b7a4a, roughness: .5, metalness: .2 }),
};
const part = (pid, mesh) => { mesh.userData.pid = pid; return mesh; };
const cyl = (r, h, mat, seg = 32) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const tube = (pts, r, mat, closed = false) =>
  new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), 48, r, 8, closed), mat);
const zAxis = m => { m.rotation.x = Math.PI / 2; return m; };   // cilindro con eje en Z

/* ---------- piezas del motor (se reutilizan en moto y vista de motor) ---------- */
function buildEngine() {
  const g = new THREE.Group();
  const crank = box(1.0, .62, .62, M.dark); crank.position.set(0, 0, 0); g.add(crank);
  const cylb = box(.5, .62, .46, M.black); cylb.position.set(.14, .62, 0); cylb.rotation.z = -.35; g.add(cylb);
  for (let i = 0; i < 6; i++) { const f = box(.56, .035, .52, M.steel); f.position.set(.04 + i * .01 + (i * .0), .36 + i * .095, 0); f.rotation.z = -.35; g.add(f); }
  const head = box(.52, .2, .5, M.dark); head.position.set(.3, 1.0, 0); head.rotation.z = -.35; g.add(head);
  // 8 bujía
  const plug = new THREE.Group();
  const pc = cyl(.045, .2, M.white, 16); pc.position.y = .1; plug.add(pc);
  const pm = cyl(.065, .06, M.steel, 6); pm.position.y = .0; plug.add(pm);
  const pt = cyl(.02, .05, M.steel, 12); pt.position.y = .22; plug.add(pt);
  plug.position.set(.36, 1.12, 0); plug.rotation.z = -.35;
  plug.children.forEach(c => part(8, c)); g.add(plug); g.userData.anchor8 = plug;
  // 12 kit de embrague (tapa lateral)
  const cl = new THREE.Group();
  const cover = zAxis(cyl(.27, .1, M.steel, 40)); cl.add(cover);
  const ring = zAxis(cyl(.2, .12, M.dark, 40)); ring.position.z = .01; cl.add(ring);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const b = zAxis(cyl(.022, .14, M.gold, 8)); b.position.set(Math.cos(a) * .235, Math.sin(a) * .235, .0); cl.add(b); }
  cl.position.set(-.12, .02, -.36); cl.children.forEach(c => part(12, c)); g.add(cl); g.userData.anchor12 = cl;
  // 1 filtro de aceite
  const of = zAxis(cyl(.1, .24, M.red, 24)); of.position.set(.38, -.02, .43); of.userData.pid = 1;
  const ofr = zAxis(cyl(.12, .03, M.black, 24)); ofr.position.set(.38, -.02, .55); ofr.userData.pid = 1;
  g.add(of, ofr); g.userData.anchor1 = of;
  // 11 aceite (tapón de llenado)
  const oc = cyl(.07, .09, M.gold, 20); oc.position.set(-.3, .36, .15); part(11, oc);
  const oc2 = cyl(.085, .03, M.black, 20); oc2.position.set(-.3, .42, .15); part(11, oc2);
  g.add(oc, oc2); g.userData.anchor11 = oc;
  // 6 piñón + tramo de cadena
  const sp = zAxis(cyl(.17, .05, M.steel, 20)); sp.position.set(-.5, -.1, .36); part(6, sp); g.add(sp);
  g.userData.anchor6 = sp;
  return g;
}

/* ---------- moto completa ---------- */
function buildBike() {
  const g = new THREE.Group();
  const WX = 1.35, WR = .6;
  const wheel = (x, rear) => {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(WR - .08, .13, 18, 48), M.rubber);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(WR - .17, .035, 12, 48), M.steel);
    w.add(tire, rim);
    for (let i = 0; i < 8; i++) { const s = box(.02, WR * 1.3, .02, M.steel); s.rotation.z = i / 8 * Math.PI; w.add(s); }
    const hub = zAxis(cyl(.07, .16, M.steel, 16)); w.add(hub);
    w.position.set(x, WR, 0);
    if (rear) { tire.userData.pid = 10; rim.userData.pid = 10; w.userData.anchor = tire; }
    w.children.forEach(c => { if (rear) c.userData.pid = 10; });
    return w;
  };
  const rw = wheel(-WX, true), fw = wheel(WX, false); g.add(rw, fw);
  g.userData.anchor10 = rw;

  // 7 disco de freno + 2 pastillas (delantero)
  const disc = zAxis(cyl(.36, .025, M.steel, 48)); disc.position.set(WX, WR, .12); part(7, disc);
  const discHole = zAxis(cyl(.2, .03, M.dark, 32)); discHole.position.set(WX, WR, .12); part(7, discHole);
  const cal = box(.16, .2, .1, M.red); cal.position.set(WX + .26, WR + .12, .12); cal.rotation.z = -.6; part(2, cal);
  const cal2 = box(.1, .14, .05, M.gold); cal2.position.set(WX + .26, WR + .12, .12); cal2.rotation.z = -.6; part(2, cal2);
  g.add(disc, discHole, cal, cal2);
  g.userData.anchor7 = disc; g.userData.anchor2 = cal;

  // horquilla + manubrio + 5 espejo + 9 faro
  const fork = tube([new THREE.Vector3(WX, WR, .12), new THREE.Vector3(WX - .22, 1.55, .12)], .035, M.steel);
  const fork2 = tube([new THREE.Vector3(WX, WR, -.12), new THREE.Vector3(WX - .22, 1.55, -.12)], .035, M.steel);
  const bar = tube([new THREE.Vector3(WX - .24, 1.6, -.45), new THREE.Vector3(WX - .24, 1.6, 0), new THREE.Vector3(WX - .24, 1.6, .45)], .03, M.black);
  g.add(fork, fork2, bar);
  const mir = new THREE.Group();
  const ms = tube([new THREE.Vector3(WX - .24, 1.62, .42), new THREE.Vector3(WX - .3, 1.86, .5)], .015, M.black);
  const mh = new THREE.Mesh(new THREE.SphereGeometry(.09, 20, 14), M.black); mh.scale.set(.5, 1, 1.3); mh.position.set(WX - .3, 1.9, .54);
  const mg = new THREE.Mesh(new THREE.CircleGeometry(.075, 20), M.glass); mg.position.set(WX - .35, 1.9, .54); mg.rotation.y = -Math.PI / 2;
  [ms, mh, mg].forEach(m => { part(5, m); mir.add(m); }); g.add(mir); g.userData.anchor5 = mh;
  const lampHouse = new THREE.Mesh(new THREE.SphereGeometry(.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.black);
  lampHouse.rotation.z = -Math.PI / 2; lampHouse.position.set(WX - .12, 1.42, 0);
  const lamp = zAxis(cyl(.17, .04, M.lamp, 28)); lamp.rotation.z = Math.PI / 2; lamp.rotation.x = 0; lamp.position.set(WX - .03, 1.42, 0);
  lamp.rotation.set(0, 0, Math.PI / 2); part(9, lamp); part(9, lampHouse); g.add(lampHouse, lamp); g.userData.anchor9 = lamp;

  // carenado frontal / tanque / asiento / cola
  const fairing = new THREE.Mesh(new THREE.SphereGeometry(.45, 24, 16), M.red); fairing.scale.set(.75, .8, .6); fairing.position.set(WX - .38, 1.12, 0); g.add(fairing);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(.55, 28, 18), M.red); tank.scale.set(1.05, .6, .6); tank.position.set(.3, 1.5, 0); g.add(tank);
  const seat = box(1.0, .14, .42, M.black); seat.position.set(-.55, 1.42, 0); seat.rotation.z = .06; g.add(seat);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(.4, 20, 14), M.red); tail.scale.set(1.6, .5, .6); tail.position.set(-1.1, 1.52, 0); g.add(tail);
  // frame
  g.add(tube([new THREE.Vector3(.8, 1.4, .17), new THREE.Vector3(.1, 1.1, .2), new THREE.Vector3(-.5, .9, .2), new THREE.Vector3(-.9, 1.3, .15)], .04, M.dark));
  g.add(tube([new THREE.Vector3(.8, 1.4, -.17), new THREE.Vector3(.1, 1.1, -.2), new THREE.Vector3(-.5, .9, -.2), new THREE.Vector3(-.9, 1.3, -.15)], .04, M.dark));
  // swingarm
  g.add(tube([new THREE.Vector3(-.2, .6, .22), new THREE.Vector3(-WX, WR, .22)], .05, M.steel));
  g.add(tube([new THREE.Vector3(-.2, .6, -.22), new THREE.Vector3(-WX, WR, -.22)], .05, M.steel));
  // exhaust
  const ex = tube([new THREE.Vector3(.55, .35, -.3), new THREE.Vector3(-.1, .22, -.38), new THREE.Vector3(-1.0, .5, -.38), new THREE.Vector3(-1.55, .75, -.36)], .09, M.steel);
  g.add(ex);

  // motor
  const eng = buildEngine(); eng.position.set(.18, .72, 0); eng.scale.setScalar(.9); g.add(eng); g.userData.engine = eng;

  // 3 amortiguador trasero (resorte + cuerpo)
  const sh = new THREE.Group();
  const shBody = cyl(.045, .85, M.dark, 14); sh.add(shBody);
  const pts = []; for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2 * 9; pts.push(new THREE.Vector3(Math.cos(a) * .09, i / 120 * .7 - .35, Math.sin(a) * .09)); }
  const spring = tube(pts, .014, M.gold); sh.add(spring);
  sh.position.set(-.85, 1.02, .0); sh.rotation.z = .55; sh.children.forEach(c => part(3, c)); g.add(sh); g.userData.anchor3 = sh;

  // 6 cadena (lado izquierdo)
  const eng_sp = new THREE.Vector3(.18 - .5 * .9, .72 - .1 * .9, .36 * .9 + 0.0);
  const chainZ = .36 * .9;
  const pA = new THREE.Vector3(-.27, .63, chainZ), pB = new THREE.Vector3(-WX, WR, chainZ);
  const loop = [
    new THREE.Vector3(pA.x, pA.y + .17, chainZ), new THREE.Vector3(pB.x, pB.y + .25, chainZ), new THREE.Vector3(pB.x - .27, pB.y, chainZ),
    new THREE.Vector3(pB.x, pB.y - .25, chainZ), new THREE.Vector3(pA.x, pA.y - .17, chainZ), new THREE.Vector3(pA.x + .2, pA.y, chainZ)];
  const chain = tube(loop, .018, M.steel, true); part(6, chain); g.add(chain); g.userData.anchor6 = chain;
  const rsp = zAxis(cyl(.27, .04, M.steel, 36)); rsp.position.set(-WX, WR, chainZ); part(6, rsp); g.add(rsp);

  // 4 batería
  const bat = box(.32, .22, .3, M.black); bat.position.set(-.45, 1.02, 0); part(4, bat);
  const bt1 = cyl(.025, .04, M.red, 10); bt1.position.set(-.4, 1.15, .08); part(4, bt1);
  const bt2 = cyl(.025, .04, M.steel, 10); bt2.position.set(-.5, 1.15, .08); part(4, bt2);
  const bl = box(.01, .12, .2, M.green); bl.position.set(-.45, 1.02, .152); bl.rotation.set(0, 0, 0); bl.scale.set(1, 1, 1);
  const bl2 = box(.2, .1, .01, M.green); bl2.position.set(-.45, 1.02, .152); part(4, bl2);
  g.add(bat, bt1, bt2, bl2); g.userData.anchor4 = bat;
  return g;
}

/* ---------- escena ---------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch (e) { root.classList.add("nowebgl"); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
canvasWrap.prepend(renderer.domElement);
renderer.domElement.setAttribute("aria-label", "Moto en 3D: arrástrala para girarla y toca una pieza para ver su precio");

const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .9;
scene.add(new THREE.HemisphereLight(0xffffff, 0x20232c, .6));
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(4, 6, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0xff3b4d, 2.2); rim.position.set(-5, 3, -4); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.01; scene.add(floor);
const grid = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.0, 64), new THREE.MeshBasicMaterial({ color: 0xd0182b, side: THREE.DoubleSide }));
grid.rotation.x = -Math.PI / 2; scene.add(grid);

const bike = buildBike(); bike.position.set(0, 0, 0); scene.add(bike);
const engine = buildEngine(); engine.scale.setScalar(1.7); engine.position.set(0, .9, 0); engine.visible = false; scene.add(engine);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.enablePan = false;
controls.minDistance = 2; controls.maxDistance = 9; controls.maxPolarAngle = Math.PI / 2 + .05;
controls.autoRotate = !reduce; controls.autoRotateSpeed = 1.2;
controls.addEventListener("start", () => { controls.autoRotate = false; });

const MODES = {
  moto: { obj: bike, cam: [2.6, 1.7, 4.2], target: [0, .85, 0], ids: [10, 7, 2, 3, 4, 5, 6, 9, 1, 8, 11, 12], anchors: {} },
  motor: { obj: engine, cam: [3.4, 2.6, 5.0], target: [0, 1.3, 0], ids: [8, 12, 1, 11, 6], anchors: {} },
};
let mode = "moto", selected = null;

/* anclajes (para puntos señaladores) */
function anchorFor(pid, m) {
  const find = o => { let r = null; o.traverse(c => { if (!r && c.userData.pid === pid) r = c; }); return r; };
  return find(MODES[m].obj);
}

/* ---------- puntos señaladores ---------- */
const dots = {};
function buildDots() {
  dotsLayer.innerHTML = ""; Object.keys(dots).forEach(k => delete dots[k]);
  MODES[mode].ids.forEach((pid, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "dot3d"; b.textContent = i + 1;
    b.setAttribute("aria-label", byId(pid).nombre);
    b.addEventListener("click", () => select(pid));
    dotsLayer.appendChild(b);
    dots[pid] = { el: b, obj: anchorFor(pid, mode) };
  });
}
const tmp = new THREE.Vector3();
function updateDots() {
  const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
  Object.entries(dots).forEach(([pid, d]) => {
    if (!d.obj) return;
    d.obj.getWorldPosition(tmp);
    // si el objeto es un grupo/tubo con origen en 0, usa el centro de su caja
    const bb = new THREE.Box3().setFromObject(d.obj); bb.getCenter(tmp);
    tmp.project(camera);
    const vis = tmp.z < 1;
    d.el.style.display = vis ? "" : "none";
    d.el.style.transform = `translate(${(tmp.x * .5 + .5) * w}px, ${(-tmp.y * .5 + .5) * h}px) translate(-50%,-50%)`;
    d.el.classList.toggle("on", +pid === selected);
  });
}

/* ---------- selección ---------- */
function highlight(pid) {
  MODES[mode].obj.traverse(c => {
    if (!c.isMesh) return;
    if (!c.userData.baseMat) c.userData.baseMat = c.material;
    if (c.userData.pid === pid && pid != null) {
      if (!c.userData.hl) { c.userData.hl = c.material.clone(); c.userData.hl.emissive = new THREE.Color(0xff2b3f); c.userData.hl.emissiveIntensity = .75; }
      c.material = c.userData.hl;
    } else c.material = c.userData.baseMat;
  });
}
function select(pid) {
  selected = pid; highlight(pid);
  const p = byId(pid);
  card.hidden = false;
  card.querySelector(".pn").textContent = p.nombre;
  card.querySelector(".pm").textContent = p.categoria + " · compatible " + p.marca;
  card.querySelector(".pp").textContent = "S/ " + p.precio;
  card.querySelector(".pa").onclick = () => { T.add(pid); const a = card.querySelector(".pa"); a.textContent = "Agregado ✓"; setTimeout(() => a.textContent = "Agregar al pedido", 1200); };
  chips.querySelectorAll("button").forEach(b => b.classList.toggle("on", +b.dataset.pid === pid));
  controls.autoRotate = false;
}
function clearSel() { selected = null; highlight(null); card.hidden = true; chips.querySelectorAll("button").forEach(b => b.classList.remove("on")); }

function buildChips() {
  chips.innerHTML = "";
  MODES[mode].ids.forEach((pid, i) => {
    const p = byId(pid), b = document.createElement("button");
    b.type = "button"; b.dataset.pid = pid; b.innerHTML = `<i>${i + 1}</i>${p.nombre}<em>S/ ${p.precio}</em>`;
    b.addEventListener("click", () => select(pid));
    chips.appendChild(b);
  });
}

/* ---------- clic en el modelo ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObject(MODES[mode].obj, true).find(h => h.object.userData.pid);
  if (hit) select(hit.object.userData.pid); else clearSel();
});
renderer.domElement.addEventListener("pointermove", e => {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObject(MODES[mode].obj, true).find(h => h.object.userData.pid);
  renderer.domElement.style.cursor = hit ? "pointer" : "grab";
});

/* ---------- modos ---------- */
function setMode(m) {
  mode = m; clearSel();
  bike.visible = m === "moto"; engine.visible = m === "motor";
  camera.position.set(...MODES[m].cam); controls.target.set(...MODES[m].target); controls.update();
  controls.autoRotate = !reduce;
  root.querySelectorAll(".tab3d").forEach(t => t.setAttribute("aria-selected", t.dataset.mode === m));
  buildChips(); buildDots();
}
root.querySelectorAll(".tab3d").forEach(t => t.addEventListener("click", () => setMode(t.dataset.mode)));

function resize() {
  const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvasWrap);

/* render solo cuando la sección está en pantalla */
let onScreen = false;
new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }, { threshold: 0 }).observe(canvasWrap);
function loop() {
  requestAnimationFrame(loop);
  if (!onScreen) return;
  controls.update(); renderer.render(scene, camera); updateDots();
}
setMode("moto"); resize(); loop();
root.classList.add("ready");
