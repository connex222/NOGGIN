'use strict';
// NOGGIN v3.5.0 Q4 — Sketch & Sabotage word fixes.
// accept:   other fair names for the same drawing (shorter or everyday names).
// replace:  duplicate prompts (the same thing twice, e.g. FIRE ENGINE and FIREENGINE)
//           swapped for new drawable words; the ID is kept.
// respace:  words that were stored without their space.
const L = s => s.split('|').map(x => x.trim()).filter(Boolean);

const accept = {
  'REMOTE CONTROL': L('remote|tv remote|controller'), 'VACUUM CLEANER': L('vacuum|hoover'), 'COAT HANGER': L('hanger|clothes hanger'),
  'ICE CREAM CONE': L('ice cream|cornet|ice cream cornet'), 'BANANA PEEL': L('banana skin'), 'TENNIS RACKET': L('racket|racquet|tennis racquet'),
  'HOT AIR BALLOON': L('balloon'), 'DOUBLE-DECKER BUS': L('double decker|bus|london bus'), 'STEAM TRAIN': L('train|steam engine|locomotive'),
  'BOW TIE': L('dicky bow'), 'FOOTBALL BOOTS': L('boots|football boot'), 'DISCO BALL': L('mirror ball|glitter ball'), 'DRUM KIT': L('drums|drum set'),
  'CINEMA TICKET': L('ticket|movie ticket|film ticket'), 'CIRCUS TENT': L('big top'), 'CLOWN NOSE': L('red nose'), 'MAGIC WAND': L('wand'),
  'CLOCK TOWER': L('big ben'), 'WIND FARM': L('wind turbines'), 'GARDEN SHED': L('shed'), 'SUBMARINE SANDWICH': L('sub|sub sandwich|baguette'),
  'TREASURE CHEST': L('treasure|chest'), 'PIRATE SHIP': L('ship|galleon'), 'DIVING MASK': L('snorkel mask|mask'), 'GIANT BEANSTALK': L('beanstalk'),
  'WITCH HAT': L('witches hat|witchs hat'), 'FAIRY WINGS': L('wings'), 'GOLDEN EGG': L('gold egg'), 'GLASS SLIPPER': L('slipper'),
  'ENCHANTED FOREST': L('forest|magic forest'), 'TELEPHONE BOX': L('phone box|telephone booth|phone booth'), 'TEA COSY': L('tea cozy'),
  'BLACK CAB': L('taxi|cab|london taxi'), 'TRAFFIC CONE': L('cone'), 'FISH AND CHIPS': L('fish n chips|fish chips'), 'BOWLER HAT': L('bowler'),
  'SHOPPING TROLLEY': L('trolley|shopping cart'), 'GAME CONTROLLER': L('controller|joypad|gamepad'), 'CHARGING CABLE': L('cable|charger cable'),
  'GIFT BOX': L('present|gift'), 'CONFETTI CANNON': L('confetti'), 'CHRISTMAS CRACKER': L('cracker'), 'PARTY POPPER': L('popper'),
  'GARDEN GNOME': L('gnome'), 'LIGHTNING BOLT': L('lightning|thunderbolt'), 'RECORD PLAYER': L('turntable|gramophone'),
  'FLYING SAUCER': L('ufo'), 'WELLINGTON BOOT': L('welly|wellie|wellington'), 'PAPER CLIP': L('paperclip'), 'POST BOX': L('red postbox|pillar box|letterbox'),
  'BICYCLE BELL': L('bike bell|bell'), 'ICE LOLLY': L('lolly|ice pop|popsicle'), 'BIRD FEEDER': L('bird table'), 'FISHING ROD': L('fishing pole|rod'),
  'WASHING LINE': L('clothes line|clothesline'), 'LIFE JACKET': L('life vest|lifejacket'), 'SNOW GLOBE': L('snow dome'), 'CLOTHES PEG': L('peg'),
  'BUS STOP': L('bus shelter'), 'PENCIL SHARPENER': L('sharpener'), 'CHEESE GRATER': L('grater'), 'PARK BENCH': L('bench'),
  'FIRE ENGINE': L('fire truck|firetruck'), 'SAFETY PIN': L('pin'), 'TIN OPENER': L('can opener'), 'PIGGY BANK': L('money box'),
  'DESK LAMP': L('lamp'), 'WOODEN SPOON': L('spoon'), 'ICE CREAM VAN': L('ice cream truck'), 'PAPER AEROPLANE': L('paper plane|paper airplane'),
  'BICYCLE HELMET': L('bike helmet|cycle helmet|cycling helmet'), 'HOT WATER BOTTLE': L('hottie'), 'CAMPING TENT': L('tent'),
  'LAWNMOWER': L('mower'), 'HULA HOOP': L('hoop'), 'DRESSING GOWN': L('bathrobe|robe'), 'SUN LOUNGER': L('lounger|sunbed'),
  'ROLLER SKATES': L('rollerskates'), 'LEMON SQUEEZER': L('juicer'), 'MAGNIFYING GLASS': L('magnifier'), 'CAMPING STOVE': L('stove|camp stove'),
  'CLOTHES HORSE': L('clothes airer|airer'), 'JIGSAW PUZZLE': L('jigsaw|puzzle'), 'BARBECUE TONGS': L('tongs|bbq tongs'),
  'HEDGE TRIMMER': L('hedge cutter'), 'PAINT ROLLER': L('roller'), 'LAUNDRY BASKET': L('washing basket'), 'WINDSCREEN WIPER': L('wiper|windshield wiper'),
  'PHONE CHARGER': L('charger'), 'RUBBER DUCK': L('duck|rubber ducky'), 'MOUSE TRAP': L('mousetrap'), 'FIRE EXTINGUISHER': L('extinguisher'),
  'TENT PEG': L('peg'), 'WIND TURBINE': L('turbine'), 'SKIPPING ROPE': L('jump rope'), 'COOKIE CUTTER': L('biscuit cutter'),
  'SPIDER WEB': L('cobweb|spiders web|spiderweb'), 'FERRIS WHEEL': L('big wheel'), 'CHOCOLATE BAR': L('chocolate'),
  'FISH TANK': L('aquarium'), 'PIZZA SLICE': L('pizza|slice of pizza'), 'SAFETY GOGGLES': L('goggles'), 'SOAP BUBBLES': L('bubbles'),
  'SHOPPING BAG': L('bag'), 'LUNCHBOX': L('lunch box'), 'TELESCOPE': L('telescope'), 'TRAFFIC LIGHTS': L('traffic light'),
  'HELTER SKELTER': L('slide'), 'CANDYFLOSS': L('candy floss|cotton candy'), 'JACK-IN-THE-BOX': L('jack in a box'),
  'TOTEM POLE': L('totem'), 'WALKING STICK': L('cane'), 'ZEBRA CROSSING': L('crossing|pedestrian crossing'), 'BUNK BED': L('bunk beds|bunks'),
  'TEDDY BEAR': L('teddy'), 'SEESAW': L('see-saw|teeter totter'), 'CATERPILLAR': L('caterpillar'), 'ICE CREAM': L('ice-cream'),
  'IRONING BOARD': L('ironing board'), 'FRYING PAN': L('pan|skillet'), 'GOLF CLUB': L('club|golf club')
};

// id -> new word (and category) for duplicates of another prompt.
const replace = {
  'p6final-sk-028': ['STETHOSCOPE', 'Jobs'], 'p6final-sk-155': ['TRAFFIC LIGHTS', 'Streets'], 'p6final-sk-022': ['HELTER SKELTER', 'Seaside'],
  'p6final-sk-089': ['CANDYFLOSS', 'Funfair'], 'p6final-sk-100': ['JACK-IN-THE-BOX', 'Toys'], 'p6b2-ske-010': ['SUNDIAL', 'Garden'],
  'p6final-sk-150': ['TOTEM POLE', 'Landmarks'], 'p6b2-ske-001': ['CATERPILLAR', 'Minibeasts'], 'p6final-sk-189': ['SNOWBOARD', 'Winter sports'],
  'p6b7-ske-005': ['WALKING STICK', 'Everyday objects'], 'p6final-sk-090': ['PADLOCK', 'Everyday objects'], 'p6final-sk-088': ['ZEBRA CROSSING', 'Streets'],
  'p6b5-ske-049': ['BUNK BED', 'Bedroom'], 'p6final-sk-147': ['TEDDY BEAR', 'Toys'], 'p6final-sk-087': ['SEESAW', 'Playground']
};
// Semantic duplicates (same drawing, different name) are replaced too.
const replaceByWord = {'BIKE HELMET': ['KANGAROO', 'Animals'], 'RED POSTBOX': ['LADYBIRD', 'Minibeasts'], 'SAND TIMER': ['SAXOPHONE', 'Music']};

const respace = {ICECREAM: 'ICE CREAM', IRONINGBOARD: 'IRONING BOARD', PICNICBASKET: 'PICNIC BASKET', PICTUREFRAME: 'PICTURE FRAME',
  PLANTPOT: 'PLANT POT', POCKETWATCH: 'POCKET WATCH', BEACHBALL: 'BEACH BALL', FRYINGPAN: 'FRYING PAN', GOLFCLUB: 'GOLF CLUB'};

module.exports = {accept, replace, replaceByWord, respace};
