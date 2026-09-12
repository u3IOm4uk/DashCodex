(function(root){
'use strict';

const APP_CONFIG=Object.freeze({
  defaultWorkbook:'Накопичення.xlsx',
  maxImportBytes:30*1024*1024,
  sourceKinds:Object.freeze({BUNDLED:'bundled',USER:'user'}),
  datePolicy:Object.freeze({
    maxManualRangeDays:366,
    maxAggregateDays:4001,
    contextWindowDays:30,
    contextBeforeDays:14,
    contextAfterDays:15
  }),
  performance:Object.freeze({
    aggregateCacheEntries:384
  })
});

const GROUP_NAMES=Object.freeze([
  'УСБпС',
  'УВ (с) "Захід"',
  '12 АК',
  'УВ "Курськ"',
  'УВ (с) "Північ"',
  'УОС',
  'УВ (с) "Схід"',
  'УВ (с) "Південь"'
]);

const WORKBOOK_SCHEMA=Object.freeze({
  acceptance:Object.freeze({atLeastOne:Object.freeze(['ГОЧ','ОВгП'])}),
  sheets:Object.freeze({
    ops:'ГОЧ',
    ovgp:'ОВгП',
    compare:'Застосування БК та FPV',
    personnel:'Втрати ЗСУ'
  }),
  rows:Object.freeze({
    opsSummary:'ВСЬОГО за СО:',
    ovgpTotal:'ВСЬОГО за СО'
  }),
  fields:Object.freeze({
    ops:Object.freeze({
      shells:Object.freeze(['Обстріли']),
      rockets:Object.freeze(['Ракетні удари','Застосовано ракет']),
      air:Object.freeze(['АУ','КАБ','КАР']),
      assault:Object.freeze(['Бойові зіткнення','Штурмові дії']),
      ongoing:Object.freeze(['Тривають (бз)','Тривають (шд)']),
      positions:Object.freeze(['Всього втрачено позицій','Відновлено позицій']),
      territory:Object.freeze(['відновлено_територій','втрачено_територій']),
      losses:Object.freeze(['Втрати_всього_ЗСУ','Втрати_всього_рф']),
      drones:Object.freeze(['ВСЬОГО УДАРІВ БпЛА']),
      dronesOther:'БпС без FPV'
    }),
    compare:Object.freeze({
      ammo:Object.freeze(['Наші війська_БК','Противник_БК']),
      fpv:Object.freeze(['Наші війська_FPV','Противник_FPV'])
    }),
    personnel:Object.freeze({
      total:Object.freeze(['ВСЬОГО_доба']),
      irreversible:Object.freeze(['безповоротні_доба']),
      medical:Object.freeze(['санітарні_доба']),
      missing:Object.freeze(['зниклі_безвісті_доба']),
      captured:Object.freeze(['полон_доба'])
    })
  }),
  droneTypes:Object.freeze([
    Object.freeze({id:'shahed',name:'Шахеди / Гербера / Пародія',field:'Шахеди/Гербера/Пародія',color:'#ff4560'}),
    Object.freeze({id:'italmas',name:'Італмас',field:'Італмас',color:'#e78e63'}),
    Object.freeze({id:'lancet',name:'Ланцет',field:'Ланцет',color:'#c2bd51'}),
    Object.freeze({id:'molniya',name:'Молнія',field:'Молнія',color:'#10b981'}),
    Object.freeze({id:'banderol',name:'Бандероль',field:'Бандероль',color:'#5dc9d8'}),
    Object.freeze({id:'privet',name:'Привіт / Куб',field:'Привіт/Куб',color:'#aa91de'}),
    Object.freeze({id:'fpv',name:'FPV-дрони',field:'FPV-дрони',color:'#e58caf'})
  ])
});

function source(kind,name){
  const values=Object.values(APP_CONFIG.sourceKinds);
  if(!values.includes(kind))throw new Error(`Невідомий тип джерела: ${kind}`);
  return Object.freeze({kind,name:String(name||APP_CONFIG.defaultWorkbook)});
}

root.ContourConfig={APP_CONFIG,WORKBOOK_SCHEMA,GROUP_NAMES,source};
if(typeof module!=='undefined')module.exports=root.ContourConfig;
})(typeof window!=='undefined'?window:globalThis);
