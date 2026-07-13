const STORAGE_KEY='notetree_pages_v1';
let pages=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
let currentPageId=null,newPageParentId=null,contextPageId=null,renamePageId=null,draggedPageId=null,saveTimer=null;
const collapsedPages=new Set();

const $=id=>document.getElementById(id);
const homeView=$('homeView'),pageView=$('pageView'),searchView=$('searchView');
const pageTitle=$('pageTitle'),pageContent=$('pageContent');

function uid(){return crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(pages));}
function pageById(id){return pages.find(page=>page.id===id);}
function compareTitles(a,b){return a.title.localeCompare(b.title,undefined,{sensitivity:'base',numeric:true});}
function compareChildOrder(a,b){
 const aHasOrder=Number.isFinite(a.sortOrder),bHasOrder=Number.isFinite(b.sortOrder);
 if(aHasOrder&&bHasOrder&&a.sortOrder!==b.sortOrder)return a.sortOrder-b.sortOrder;
 if(aHasOrder!==bHasOrder)return aHasOrder?-1:1;
 return compareTitles(a,b);
}
function childrenOf(id){return pages.filter(page=>page.parentId===id).sort(id===null?compareTitles:compareChildOrder);}
function showOnly(view){[homeView,pageView,searchView].forEach(item=>item.hidden=item!==view);}
function renderActiveView(){if(!pageView.hidden)renderPage();else if(!searchView.hidden)renderSearch();else renderHome();}

function makePageRow(page,detail=''){
 const row=document.createElement('div');row.className='page-row';
 const open=document.createElement('button');open.type='button';
 const title=document.createElement('strong');title.textContent=page.title||'Untitled';open.append(title);
 if(detail){const small=document.createElement('small');small.textContent=detail;open.append(small);}
 open.onclick=()=>openPage(page.id);
 const count=document.createElement('span');count.className='page-count';
 const childCount=childrenOf(page.id).length;count.textContent=childCount?`${childCount} subpage${childCount===1?'':'s'}`:'';
 row.append(open,count);return row;
}

function treeBranch(page){
 const branch=document.createElement('div');branch.className='tree-branch';
 const row=document.createElement('div');row.className=`tree-row${page.parentId===null?' root':''}${page.id===currentPageId?' active':''}`;
 const children=childrenOf(page.id);
 const toggle=document.createElement('button');toggle.type='button';toggle.className='tree-toggle';
 if(children.length){
  toggle.textContent=collapsedPages.has(page.id)?'›':'⌄';
  toggle.setAttribute('aria-label',`${collapsedPages.has(page.id)?'Expand':'Collapse'} ${page.title||'Untitled'}`);
  toggle.onclick=event=>{event.stopPropagation();collapsedPages.has(page.id)?collapsedPages.delete(page.id):collapsedPages.add(page.id);renderTree();};
 }else{toggle.classList.add('placeholder');toggle.textContent='·';toggle.tabIndex=-1;}
 const open=document.createElement('button');open.type='button';open.className='tree-page';open.textContent=page.title||'Untitled';open.title=page.title||'Untitled';open.onclick=()=>openPage(page.id);
 row.oncontextmenu=event=>openPageContextMenu(event,page.id);
 if(page.parentId!==null){
  row.draggable=true;
  row.ondragstart=event=>startPageDrag(event,page.id);
  row.ondragover=event=>dragPageOver(event,page.id);
  row.ondrop=event=>dropPage(event,page.id);
  row.ondragend=endPageDrag;
 }
 row.append(toggle,open);branch.append(row);
 if(children.length&&!collapsedPages.has(page.id)){
  const nested=document.createElement('div');nested.className='tree-children';nested.replaceChildren(...children.map(treeBranch));branch.append(nested);
 }
 return branch;
}

function renderTree(){
 const roots=childrenOf(null);$('pageTree').replaceChildren(...roots.map(treeBranch));$('emptyTree').hidden=roots.length>0;
}

function renderHome(){
 showOnly(homeView);currentPageId=null;renderTree();
 const roots=childrenOf(null),list=$('rootPages');list.replaceChildren(...roots.map(page=>makePageRow(page,page.content.slice(0,80))));
 $('emptyHome').hidden=roots.length>0;
}

function ancestorPath(page){
 const path=[];let item=page,seen=new Set();
 while(item&&!seen.has(item.id)){seen.add(item.id);path.unshift(item);item=pageById(item.parentId);}
 return path;
}

function revealInTree(page){
 ancestorPath(page).slice(0,-1).forEach(ancestor=>collapsedPages.delete(ancestor.id));
}

function renderBreadcrumbs(page){
 const bar=$('breadcrumbs');bar.replaceChildren();
 const home=document.createElement('button');home.type='button';home.textContent='Pages';home.onclick=goHome;bar.append(home);
 ancestorPath(page).forEach(item=>{
  const separator=document.createElement('span');separator.className='breadcrumb-separator';separator.textContent='›';
  const button=document.createElement('button');button.type='button';button.textContent=item.title||'Untitled';button.onclick=()=>openPage(item.id);
  bar.append(separator,button);
 });
}

function resizeEditor(){pageContent.style.height='auto';pageContent.style.height=`${Math.max(pageContent.scrollHeight,window.innerHeight*.52)}px`;}

function renderPage(){
 const page=pageById(currentPageId);if(!page){renderHome();return;}
 showOnly(pageView);revealInTree(page);renderTree();renderBreadcrumbs(page);pageTitle.value=page.title;pageContent.value=page.content;requestAnimationFrame(resizeEditor);
 const children=childrenOf(page.id);$('childPages').replaceChildren(...children.map(child=>makePageRow(child,child.content.slice(0,80))));
 const linked=(page.links||[]).map(pageById).filter(Boolean).sort(compareTitles);
 $('pageLinks').replaceChildren(...linked.map(link=>makePageRow(link,'Linked page')));
 const incoming=pages.filter(candidate=>(candidate.links||[]).includes(page.id)).sort(compareTitles);
 $('backlinks').replaceChildren(...incoming.map(link=>makePageRow(link,'Links to this page')));
 const options=pages.filter(candidate=>candidate.id!==page.id&&!(page.links||[]).includes(candidate.id)).sort(compareTitles);
 const select=$('linkTarget');select.replaceChildren();
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=options.length?'Choose a page':'No pages available';select.append(placeholder);
 options.forEach(optionPage=>{const option=document.createElement('option');option.value=optionPage.id;option.textContent=optionPage.title||'Untitled';select.append(option);});
}

function openPage(id,push=true){
 if(!pageById(id))return;currentPageId=id;renderPage();
 if(push)history.pushState({pageId:id},'',`#page=${encodeURIComponent(id)}`);
 window.scrollTo(0,0);
}

function goHome(push=true){renderHome();if(push)history.pushState({},'',location.pathname);window.scrollTo(0,0);}

function schedulePageSave(){
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
  const page=pageById(currentPageId);if(!page)return;
  page.title=pageTitle.value.trim()||'Untitled';page.content=pageContent.value;page.updatedAt=new Date().toISOString();save();renderBreadcrumbs(page);renderTree();
 },180);
}

function openNewPageDialog(parentId){newPageParentId=parentId;$('newPageTitle').value='';$('newPageHeading').textContent=parentId?'New subpage':'New page';$('newPageDialog').showModal();$('newPageTitle').focus();}

function clearDropIndicators(){document.querySelectorAll('.tree-row.drop-before,.tree-row.drop-after').forEach(row=>row.classList.remove('drop-before','drop-after'));}

function validDropTarget(targetId){
 const dragged=pageById(draggedPageId),target=pageById(targetId);
 return dragged&&target&&dragged.id!==target.id&&dragged.parentId!==null&&dragged.parentId===target.parentId;
}

function startPageDrag(event,pageId){
 draggedPageId=pageId;closePageContextMenu();event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',pageId);
 const row=event.currentTarget;requestAnimationFrame(()=>row.classList.add('dragging'));
}

function dragPageOver(event,targetId){
 if(!validDropTarget(targetId))return;
 event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';clearDropIndicators();
 const row=event.currentTarget,position=event.clientY<row.getBoundingClientRect().top+row.offsetHeight/2?'before':'after';
 row.classList.add(`drop-${position}`);
}

function reorderSiblings(draggedId,targetId,position){
 const dragged=pageById(draggedId),target=pageById(targetId);if(!dragged||!target||dragged.parentId!==target.parentId||dragged.parentId===null)return;
 const siblings=childrenOf(dragged.parentId).filter(page=>page.id!==draggedId);let targetIndex=siblings.findIndex(page=>page.id===targetId);if(targetIndex<0)return;
 if(position==='after')targetIndex+=1;siblings.splice(targetIndex,0,dragged);siblings.forEach((page,index)=>page.sortOrder=index);save();renderActiveView();
}

function dropPage(event,targetId){
 if(!validDropTarget(targetId))return;
 event.preventDefault();event.stopPropagation();const row=event.currentTarget,position=row.classList.contains('drop-after')?'after':'before';
 const draggedId=draggedPageId;endPageDrag();reorderSiblings(draggedId,targetId,position);
}

function endPageDrag(){
 draggedPageId=null;clearDropIndicators();document.querySelectorAll('.tree-row.dragging').forEach(row=>row.classList.remove('dragging'));
}

function closePageContextMenu(){
 const menu=$('pageContextMenu');menu.hidden=true;contextPageId=null;
}

function openPageContextMenu(event,pageId){
 event.preventDefault();event.stopPropagation();contextPageId=pageId;
 const menu=$('pageContextMenu');menu.hidden=false;
 const margin=8,width=menu.offsetWidth,height=menu.offsetHeight;
 menu.style.left=`${Math.max(margin,Math.min(event.clientX,window.innerWidth-width-margin))}px`;
 menu.style.top=`${Math.max(margin,Math.min(event.clientY,window.innerHeight-height-margin))}px`;
 menu.querySelector('button').focus();
}

function openRenamePageDialog(pageId){
 const page=pageById(pageId);if(!page)return;
 renamePageId=pageId;$('renamePageTitle').value=page.title;$('renamePageDialog').showModal();$('renamePageTitle').select();
}

function deletePage(pageId){
 const page=pageById(pageId);if(!page||!confirm(`Delete “${page.title}” and all of its subpages?`))return;
 const ids=new Set([page.id]);let changed=true;
 while(changed){changed=false;pages.forEach(candidate=>{if(ids.has(candidate.parentId)&&!ids.has(candidate.id)){ids.add(candidate.id);changed=true;}});}
 pages=pages.filter(candidate=>!ids.has(candidate.id)).map(candidate=>({...candidate,links:(candidate.links||[]).filter(id=>!ids.has(id))}));save();
 if(ids.has(currentPageId))goHome();else renderActiveView();
}

$('newPageForm').onsubmit=event=>{
 event.preventDefault();const title=$('newPageTitle').value.trim();if(!title)return;
 const now=new Date().toISOString();const page={id:uid(),parentId:newPageParentId,title,content:'',links:[],createdAt:now,updatedAt:now};
 const orderedSiblings=newPageParentId===null?[]:childrenOf(newPageParentId).filter(sibling=>Number.isFinite(sibling.sortOrder));
 if(orderedSiblings.length)page.sortOrder=Math.max(...orderedSiblings.map(sibling=>sibling.sortOrder))+1;
 pages.push(page);if(newPageParentId)collapsedPages.delete(newPageParentId);save();$('newPageDialog').close();openPage(page.id);
};
$('cancelNewPage').onclick=()=>$('newPageDialog').close();
$('renamePageForm').onsubmit=event=>{
 event.preventDefault();const page=pageById(renamePageId),title=$('renamePageTitle').value.trim();if(!page||!title)return;
 page.title=title;page.updatedAt=new Date().toISOString();save();$('renamePageDialog').close();renamePageId=null;
 renderActiveView();
};
$('cancelRenamePage').onclick=()=>{$('renamePageDialog').close();renamePageId=null;};
$('pageContextMenu').onclick=event=>{
 const action=event.target.closest('[data-action]')?.dataset.action,pageId=contextPageId;if(!action||!pageId)return;
 closePageContextMenu();
 if(action==='add')openNewPageDialog(pageId);
 if(action==='rename')openRenamePageDialog(pageId);
 if(action==='delete')deletePage(pageId);
};
document.addEventListener('pointerdown',event=>{if(!event.target.closest('#pageContextMenu'))closePageContextMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closePageContextMenu();});
window.addEventListener('blur',closePageContextMenu);window.addEventListener('resize',closePageContextMenu);
$('pageTree').addEventListener('scroll',closePageContextMenu,true);
$('pageTree').addEventListener('dragover',clearDropIndicators);
$('newRootBtn').onclick=()=>openNewPageDialog(null);
$('mobileNewBtn').onclick=()=>openNewPageDialog(null);
$('welcomeNewBtn').onclick=()=>openNewPageDialog(null);
$('addChildBtn').onclick=()=>openNewPageDialog(currentPageId);
$('detailsAddChildBtn').onclick=()=>openNewPageDialog(currentPageId);
$('homeBtn').onclick=()=>goHome();
pageTitle.addEventListener('input',schedulePageSave);pageContent.addEventListener('input',()=>{schedulePageSave();resizeEditor();});

$('addLinkBtn').onclick=()=>{
 const page=pageById(currentPageId),target=$('linkTarget').value;if(!page||!target)return;
 page.links=[...(page.links||[]),target];page.updatedAt=new Date().toISOString();save();renderPage();
};

$('deletePageBtn').onclick=()=>{
 deletePage(currentPageId);
};

function renderSearch(){
 renderTree();const query=$('searchInput').value.trim().toLocaleLowerCase();const results=$('searchResults');results.replaceChildren();
 if(!query){$('searchMessage').textContent='Type to search all pages.';$('searchMessage').hidden=false;return;}
 const matches=pages.filter(page=>`${page.title} ${page.content}`.toLocaleLowerCase().includes(query)).sort(compareTitles);
 $('searchMessage').textContent=matches.length?'':'No matching pages.';$('searchMessage').hidden=matches.length>0;
 matches.forEach(page=>results.append(makePageRow(page,page.content.slice(0,100))));
}
function openSearch(){showOnly(searchView);$('searchInput').value='';renderSearch();$('searchInput').focus();history.pushState({search:true},'','#search');}
$('searchBtn').onclick=openSearch;$('mobileSearchBtn').onclick=openSearch;
$('searchInput').addEventListener('input',renderSearch);$('searchForm').onsubmit=event=>{event.preventDefault();renderSearch();};
$('closeSearchBtn').onclick=()=>currentPageId?openPage(currentPageId):goHome();

window.onpopstate=event=>{if(event.state?.pageId)openPage(event.state.pageId,false);else if(event.state?.search){showOnly(searchView);renderSearch();}else renderHome();};

const hashPage=new URLSearchParams(location.hash.replace(/^#/,'' )).get('page');
if(hashPage&&pageById(hashPage))openPage(hashPage,false);else renderHome();
