(function(){
  if(document.querySelector('[data-dir-banners="1"]')) return;
  var w=document.createElement('div');
  w.setAttribute('data-dir-banners','1');
  w.style.cssText='display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin:16px 0;';
  w.innerHTML=''
    +'<a href="https://ffa-links.de/ref/b29e71de5c65e1d961" target="_blank" rel="noopener"><img src="https://ffa-links.de/banner.svg" alt="FFA-Links" height="60" style="border-radius:4px;"></a>'
    +'<a href="https://swiss-quality.de/ref/87e403ac79a7a39bdd" target="_blank" rel="noopener"><img src="https://swiss-quality.de/banner.svg" alt="Swiss Quality" height="60" style="border-radius:4px;"></a>'
    +'<a href="https://german-quality.net/ref/b3cafb1ce07b07eaec" target="_blank" rel="noopener"><img src="https://german-quality.net/banner.svg" alt="German Quality" height="60" style="border-radius:4px;"></a>';
  var foot=document.querySelector('footer');
  if(foot){
    if(foot.parentNode) foot.parentNode.insertBefore(w, foot.nextSibling);
    else foot.appendChild(w);
  } else if(document.body) document.body.appendChild(w);
})();
