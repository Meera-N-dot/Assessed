import { cid, fmtDate, escapeHtml, csvEscape } from './utils.js';
import { loadState, saveState } from './storage.js';

//  simple store in localstorage 
  const STORE_KEY = 'quickAddStore.v1';
  const defaultData = {
    userName: 'Teacher',
    classes: [
      { id: cid(), name: 'Intro Physics', block: 'Block 2', color: 'var(--tile1)', roster: ['Barak Yedidia','Jana Comstock','Wes Chao'] },
      { id: cid(), name: 'Intro Physics', block: 'Block 4', color: 'var(--tile2)', roster: ['Liza Raynal','Angi Chau','Claire Yeo'] },
      { id: cid(), name: 'Modern Physics', block: 'Block 5', color: 'var(--tile3)', roster: ['Jackee Bruno','Patrick Berger'] },
      { id: cid(), name: 'Modern Physics', block: 'Block 6', color: 'var(--tile4)', roster: ['Matthew Hesby'] },
    ],
    students: ['Barak Yedidia','Jana Comstock','Wes Chao','Liza Raynal','Angi Chau','Claire Yeo','Jackee Bruno','Patrick Berger','Matthew Hesby'],
    quickAdds: [] // {id, ts, classId, students[], note}
  };

  // small helpers
  function cid(){ return Math.random().toString(36).slice(2,10); } // makes a short id
  function load(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || structuredClone(defaultData);}catch{ return structuredClone(defaultData);} }
  function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); } // persist to localstorage
  function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;","&gt;":"&gt;","\"":"&quot;","'":"&#39;"}[m])); } // basic xss guard
  function fmtDate(ts){ return new Date(ts).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}); } // readable date

  let state = load(); // load once

  //  grab dom refs once 
  const userNameEl = document.getElementById('userName');
  const editNameBtn = document.getElementById('editNameBtn');
  const exportBtn = document.getElementById('exportBtn');

  const dashboardView = document.getElementById('view-dashboard');
  const classSelect = document.getElementById('classSelect');
  const studentChecks = document.getElementById('studentChecks');
  const quickForm = document.getElementById('quickForm');
  const quickNote = document.getElementById('quickNote');
  const quickStatus = document.getElementById('quickStatus');
  const clearFormBtn = document.getElementById('clearFormBtn');
  const addClassBtn = document.getElementById('addClassBtn');
  const classTiles = document.getElementById('classTiles');
  const tileTemplate = document.getElementById('tileTemplate');

  const classView = document.getElementById('view-class');
  const classTitle = document.getElementById('classTitle');
  const subtitle = document.getElementById('subtitle');
  const rosterChips = document.getElementById('rosterChips');
  const rosterCount = document.getElementById('rosterCount');
  const newStudent = document.getElementById('newStudent');
  const addStudent = document.getElementById('addStudent');
  const noteStudentChecks = document.getElementById('noteStudentChecks'); // where checkboxes go
  const noteText = document.getElementById('noteText');
  const saveNote = document.getElementById('saveNote');
  const noteStatus = document.getElementById('noteStatus');
  const clearNote = document.getElementById('clearNote');
  const refresh = document.getElementById('refresh');
  const entries = document.getElementById('entries');
  const scrollToClasses = document.getElementById('scrollToClasses');

  //  tiny hash router 
  function getRoute(){
    const hash = location.hash || '#/';
    const parts = hash.slice(2).split('/'); // after "#/"
    if(parts[0] === '') return {name:'dashboard'};
    if(parts[0] === 'class' && parts[1]) return {name:'class', id: parts[1]};
    return {name:'dashboard'};
  }

  // show dashboard
  function navigateToDashboard(){
    dashboardView.classList.add('active');
    classView.classList.remove('active');
    renderDashboard();
  }

  // show class view
  function navigateToClass(id){
    const cls = state.classes.find(c=>c.id===id);
    if(!cls){ location.hash = '#/'; return; }
    dashboardView.classList.remove('active');
    classView.classList.add('active');
    renderClassView(cls);
  }

  // react to url changes
  window.addEventListener('hashchange', ()=> {
    const route = getRoute();
    if(route.name==='dashboard') navigateToDashboard();
    else if(route.name==='class') navigateToClass(route.id);
  });

  //  dashboard render 
  function renderDashboard(){
    userNameEl.textContent = state.userName || 'Teacher';

    // fill class dropdown
    classSelect.innerHTML = '';
    state.classes.forEach(c=> classSelect.add(new Option(`${c.name} (${c.block})`, c.id)));
    if(!classSelect.value && state.classes[0]) classSelect.value = state.classes[0].id;

    renderStudentChecks(); // checkboxes for the chosen class
    renderTiles();         // class cards on the right
  }

  // get currently selected class (for quick add)
  function currentClass(){ return state.classes.find(c=>c.id === classSelect.value) || state.classes[0]; }

  // build student checkboxes for quick add form
  function renderStudentChecks(){
    const c = currentClass();
    studentChecks.innerHTML = '';
    if(!c){ studentChecks.innerHTML = '<div class="muted">Create a class to begin.</div>'; return; }
    const names = [...(c.roster||[])].sort((a,b)=>a.localeCompare(b));
    names.forEach(name=>{
      const id = 's_' + name.replace(/\W+/g,'_');
      const wrap = document.createElement('label');
      wrap.className = 'check';
      wrap.innerHTML = `<input type="checkbox" id="${id}"> <span>${escapeHtml(name)}</span>`;
      studentChecks.appendChild(wrap);
    });
  }

  // build class tiles (navigate + delete)
  function renderTiles(){
    classTiles.innerHTML = '';
    state.classes.forEach((c)=>{
      const node = tileTemplate.content.cloneNode(true);
      const link = node.querySelector('.tile-link');
      const tile = node.querySelector('.tile');
      const h3 = node.querySelector('h3');
      const count = node.querySelector('.rosterCount');
      const delBtn = node.querySelector('[data-delete]');

      tile.style.background = c.color || 'var(--tile1)';
      h3.innerHTML = `${escapeHtml(c.name)}<br>${escapeHtml(c.block)}`;
      count.textContent = `${c.roster?.length||0} student${(c.roster?.length||0)===1?'':'s'}`;

      // in-page route
      link.href = `#/class/${encodeURIComponent(c.id)}`;

      // delete class (and its notes)
      delBtn.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        if(confirm(`Delete class: ${c.name} (${c.block})?\nThis will also remove its notes.`)){
          state.quickAdds = (state.quickAdds||[]).filter(n => n.classId !== c.id);
          state.classes = state.classes.filter(x=>x.id!==c.id);
          save();
          renderDashboard();
        }
      });

      classTiles.appendChild(node);
    });
  }

  //  class view render 
  function renderClassView(cls){
    classTitle.textContent = `${cls.name} (${cls.block})`;
    subtitle.textContent = 'Class Page';
    renderRoster(cls);
    renderNoteStudentChecks(cls); // set up checkboxes for note
    renderEntries(cls);
  }

  // show roster as chips with remove buttons
  function renderRoster(cls){
    rosterChips.innerHTML = '';
    (cls.roster||[]).forEach(name=>{
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `${escapeHtml(name)} <button class="icon-btn" title="Remove ${escapeHtml(name)}">✕</button>`;
      chip.querySelector('button').addEventListener('click', ()=>{
        cls.roster = (cls.roster||[]).filter(n=>n!==name);
        save();
        renderRoster(cls);
        renderNoteStudentChecks(cls);
      });
      rosterChips.appendChild(chip);
    });
    const count = cls.roster?.length || 0;
    rosterCount.textContent = `${count} student${count===1?'':'s'}`;
  }

  // checkboxes for note selection (class view)
  function renderNoteStudentChecks(cls){
    noteStudentChecks.innerHTML = '';
    (cls.roster||[]).slice().sort((a,b)=>a.localeCompare(b)).forEach(name=>{
      const id = 'ns_' + name.replace(/\W+/g,'_');
      const wrap = document.createElement('label');
      wrap.className = 'check';
      wrap.innerHTML = `<input type="checkbox" id="${id}" value="${escapeHtml(name)}"> <span>${escapeHtml(name)}</span>`;
      noteStudentChecks.appendChild(wrap);
    });
  }

  // list recent notes for this class
  function renderEntries(cls){
    entries.innerHTML = '';
    const list = (state.quickAdds||[]).filter(e=>e.classId===cls.id).slice(0,25);
    if(list.length===0){
      entries.innerHTML = '<div class="field"><span class="mini">No notes yet.</span></div>';
      return;
    }
    list.forEach(e=>{
      const div = document.createElement('div');
      div.className = 'entry';
      const students = (e.students||[]).join(', ') || '—';
      const note = e.note || '—';
      div.innerHTML = `<div class="date">${fmtDate(e.ts)}</div><div>${escapeHtml(note)}</div><div class="mini" style="margin-top:4px">Students: ${escapeHtml(students)}</div>`;
      entries.appendChild(div);
    });
  }

  //  events (ui actions) 

  // rename the user
  editNameBtn.addEventListener('click', ()=>{
    const name = prompt('Enter your display name:', state.userName || '');
    if(name!==null){ state.userName = name.trim() || 'Teacher'; userNameEl.textContent = state.userName; save(); }
  });

  // export notes as csv (for spreadsheets)
  exportBtn.addEventListener('click', ()=>{
    const rows = [];
    rows.push(['timestamp','date','classId','className','block','students','note']);
    (state.quickAdds||[]).forEach(e=>{
      const cls = (state.classes||[]).find(c=>c.id===e.classId) || {};
      rows.push([
        e.ts,
        new Date(e.ts).toISOString(),
        e.classId || '',
        cls.name || '',
        cls.block || '',
        (e.students||[]).join('; '),
        e.note || ''
      ]);
    });
    const csv = rows.map(r=>r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'notes.csv'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  });

  // escape csv fields safely
  function csvEscape(v){
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }

  // switch class in quick add
  classSelect.addEventListener('change', renderStudentChecks);

  // add a new class quickly
  addClassBtn.addEventListener('click', ()=>{
    const name = prompt('Class name (e.g., Intro Physics)'); if(!name) return;
    const block = prompt('Block/Section (e.g., Block 4)') || '';
    const colors = ['var(--tile1)','var(--tile2)','var(--tile3)','var(--tile4)'];
    state.classes.push({ id: cid(), name: name.trim(), block: block.trim(), color: colors[state.classes.length%colors.length], roster: [] });
    save();
    renderDashboard();
  });

  // clear the quick add form
  clearFormBtn.addEventListener('click', ()=>{
    document.querySelectorAll('#studentChecks input[type="checkbox"]').forEach(cb=>cb.checked=false);
    quickNote.value='';
    quickStatus.textContent='';
  });

  // save quick note (no popup, just inline status)
  quickForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const c = currentClass();
    if(!c){ return; }
    const chosen = Array.from(studentChecks.querySelectorAll('input:checked')).map(cb=>cb.nextElementSibling.textContent);
    const note = quickNote.value.trim();
    state.quickAdds.unshift({ id: cid(), ts: Date.now(), classId: c.id, students: chosen, note });
    save();
    quickNote.value='';
    document.querySelectorAll('#studentChecks input[type="checkbox"]').forEach(cb=>cb.checked=false);
    quickStatus.textContent = 'saved';
    setTimeout(()=> quickStatus.textContent = '', 1500);
  });

  // add a student to this class (class view)
  addStudent.addEventListener('click', ()=>{
    const route = getRoute(); if(route.name!=='class') return;
    const cls = state.classes.find(c=>c.id===route.id); if(!cls) return;
    const val = newStudent.value.trim(); if(!val) return;
    cls.roster = cls.roster || [];
    if(!cls.roster.includes(val)) cls.roster.push(val);
    state.students = state.students || [];
    if(!state.students.includes(val)) state.students.push(val);
    newStudent.value = '';
    save();
    renderRoster(cls);
    renderNoteStudentChecks(cls);
  });

  // save class note (checkbox selection)
  saveNote.addEventListener('click', ()=>{
    const route = getRoute(); if(route.name!=='class') return;
    const cls = state.classes.find(c=>c.id===route.id); if(!cls) return;
    const chosen = Array.from(noteStudentChecks.querySelectorAll('input:checked')).map(cb=>cb.nextElementSibling.textContent);
    const note = noteText.value.trim();
    state.quickAdds.unshift({ id: cid(), ts: Date.now(), classId: cls.id, students: chosen, note });
    save();
    noteText.value = '';
    noteStudentChecks.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=false);
    renderEntries(cls);
    noteStatus.textContent = 'saved';
    setTimeout(()=> noteStatus.textContent = '', 1500);
  });

  // clear class note form
  clearNote.addEventListener('click', ()=>{
    noteText.value='';
    noteStudentChecks.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=false);
    noteStatus.textContent='';
  });

  // manual refresh of recent notes list
  refresh.addEventListener('click', ()=>{
    const route = getRoute();
    if(route.name==='class'){
      const cls = state.classes.find(c=>c.id===route.id);
      if(cls) renderEntries(cls);
    }
  });

  // scroll shortcut
  scrollToClasses.addEventListener('click', ()=>{
    document.getElementById('classesPanel').scrollIntoView({behavior:'smooth', block:'start'});
  });

  //  start the app 
  function routeNow(){
    const route = getRoute();
    if(route.name==='dashboard') navigateToDashboard();
    else if(route.name==='class') navigateToClass(route.id);
  }
  userNameEl.textContent = state.userName || 'Teacher';
  routeNow();