
async function search(){
 const q=document.getElementById('search').value;
 const res=await fetch('/.netlify/functions/ebay-search?q='+encodeURIComponent(q));
 const data=await res.json();
 const el=document.getElementById('products');
 el.innerHTML='';
 (data.items||[]).forEach(p=>{
   const d=document.createElement('div');
   d.className='card';
   d.innerHTML=`<img src="${p.image}"><h3>${p.title}</h3><p>$${p.price}</p><a target="_blank" href="${p.url}">View</a>`;
   el.appendChild(d);
 });
}
