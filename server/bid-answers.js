'use strict';
// Server-only equivalence rules; this module never decides whether an unlisted
// real-world answer belongs to an open-ended category.
function normalise(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}
const variants = {
  'sun cream':['sunscreen','sunblock','sun lotion'],
  'wellies':['wellington boots','wellingtons'],
  'trainers':['sneakers'],
  'aubergine':['eggplant'],
  'courgette':['zucchini'],
  'scallion':['spring onion'],
  'coriander':['cilantro'],
  'bell pepper':['capsicum'],
  'torch':['flashlight'],
  'rubber':['eraser'],
  'rubbish bin':['trash can','bin'],
  'aeroplane':['airplane','plane'],
  'bicycle':['bike','cycle'],
  'mobile phone':['cell phone','cellphone'],
  'football':['soccer ball'],
  'plasters':['plaster','adhesive bandages','band aids','bandaids'],
  'sterile gauze':['gauze'],
  'disposable gloves':['gloves'],
  'adhesive tape':['medical tape'],
  'antiseptic wipes':['wipes'],
  'frying pan':['skillet'],
  'pottery wheel':['potters wheel'],
  'wire cutter':['cutting wire'],
  'pitta':['pita','pita bread','pitta bread'],
  'macramé':['macrame'],
  'cross-stitch':['cross stitch'],
  'semi-colon':['semicolon'],
  'full stop':['period'],
  'high e':['top e','treble e','e'],
  'low e':['bottom e','bass e'],
  'white king':['king white','white kings'],
  'black king':['king black','black kings'],
  'backstroke':['back crawl'],
  'freestyle':['front crawl'],
  '100 metres':['100m'], '200 metres':['200m'],
  '400 metres':['400m'], '800 metres':['800m'],
  '1500 metres':['1500m'], '5000 metres':['5000m'],
  '10000 metres':['10000m'],
  '3000 metres steeplechase':['3000m steeplechase','steeplechase'],
  'aluminium cans':['aluminum cans','cans'],
  'glass bottles':['bottles'],
  'glass jars':['jars'],
  'drink cartons':['cartons'],
  'check-in':['check in','checkin'],
  'tape measure':['measuring tape'],
  'seam ripper':['stitch unpicker'],
  'try square':['set square'],
  'handlebar':['handlebars'],
  'tyres':['tires'],
  'brakes':['brake'],
  'spanner':['wrench'],
  'spirit level':['level'],
  'stove':['camp stove'],
  'sleeping-bag':['sleeping bag']
};
function acceptedAnswer(category, entered) {
 const key=normalise(entered);
 for (const [index, answer] of category.answers.entries()) {
  if (normalise(answer) === key || (variants[normalise(answer)] || variants[answer.toLowerCase()] || []).some(v => normalise(v) === key)) return index;
 }
 return -1;
}
module.exports={normalise,acceptedAnswer};
