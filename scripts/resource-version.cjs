const fs=require('node:fs');

const file='index.html';
const resources=[
 'css/contour.css',
 'css/contour-detail.css',
 'css/contour-refinement.css',
 'js/contour-config.js',
 'js/contour-data.js',
 'js/contour-view.js',
 'js/contour-charts.js',
 'js/contour-navigation.js',
 'js/contour.js'
];
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
let html=fs.readFileSync(file,'utf8');
const versions=[];
for(const resource of resources){
 const match=html.match(new RegExp(`${escape(resource)}\\?v=(\\d+)`));
 if(!match){console.error(`Не знайдено versioned resource: ${resource}`);process.exit(1)}
 versions.push(Number(match[1]));
}
const unique=[...new Set(versions)];
if(unique.length!==1){console.error(`Різні resource revisions: ${unique.join(', ')}`);process.exit(1)}
const current=unique[0];
if(process.argv.includes('--check')){console.log(`Resource revision узгоджена: v=${current}`);process.exit(0)}
const explicit=process.argv.find(arg=>/^\d+$/.test(arg));
const next=explicit?Number(explicit):current+1;
if(!Number.isInteger(next)||next<1){console.error('Revision має бути додатним цілим числом.');process.exit(1)}
for(const resource of resources){
 const re=new RegExp(`${escape(resource)}\\?v=\\d+`,'g');
 html=html.replace(re,`${resource}?v=${next}`);
}
fs.writeFileSync(file,html);
console.log(`Resource revision: v=${current} -> v=${next}`);
