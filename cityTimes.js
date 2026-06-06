// Typical driving times (minutes) under normal traffic, per origin city to each hill station
const TIMES = {
  Delhi:         { Shimla:350,Manali:540,Mussoorie:290,Nainital:310,Kasol:500,Chakrata:320,Lansdowne:270,Dalhousie:590,'McLeod Ganj':570,Rishikesh:250,Almora:350,Chail:330 },
  Noida:         { Shimla:360,Manali:555,Mussoorie:295,Nainital:305,Kasol:515,Chakrata:325,Lansdowne:265,Dalhousie:605,'McLeod Ganj':585,Rishikesh:250,Almora:345,Chail:345 },
  Gurgaon:       { Shimla:355,Manali:545,Mussoorie:295,Nainital:320,Kasol:510,Chakrata:330,Lansdowne:280,Dalhousie:600,'McLeod Ganj':580,Rishikesh:260,Almora:360,Chail:340 },
  Faridabad:     { Shimla:375,Manali:565,Mussoorie:305,Nainital:320,Kasol:530,Chakrata:340,Lansdowne:285,Dalhousie:615,'McLeod Ganj':595,Rishikesh:265,Almora:355,Chail:355 },
  Ghaziabad:     { Shimla:360,Manali:550,Mussoorie:285,Nainital:300,Kasol:510,Chakrata:315,Lansdowne:260,Dalhousie:600,'McLeod Ganj':580,Rishikesh:240,Almora:340,Chail:345 },
  'Greater Noida':{ Shimla:370,Manali:560,Mussoorie:300,Nainital:310,Kasol:520,Chakrata:330,Lansdowne:275,Dalhousie:610,'McLeod Ganj':590,Rishikesh:255,Almora:345,Chail:350 },
  Chandigarh:    { Shimla:115,Manali:255,Mussoorie:280,Nainital:360,Kasol:215,Chakrata:280,Lansdowne:390,Dalhousie:190,'McLeod Ganj':175,Rishikesh:210,Almora:430,Chail:125 },
  Ambala:        { Shimla:165,Manali:320,Mussoorie:270,Nainital:360,Kasol:275,Chakrata:265,Lansdowne:375,Dalhousie:250,'McLeod Ganj':235,Rishikesh:215,Almora:435,Chail:185 },
  Rohtak:        { Shimla:300,Manali:490,Mussoorie:270,Nainital:360,Kasol:455,Chakrata:285,Lansdowne:300,Dalhousie:545,'McLeod Ganj':530,Rishikesh:235,Almora:400,Chail:315 },
  Hisar:         { Shimla:340,Manali:525,Mussoorie:310,Nainital:400,Kasol:495,Chakrata:330,Lansdowne:345,Dalhousie:565,'McLeod Ganj':550,Rishikesh:275,Almora:440,Chail:355 },
  Karnal:        { Shimla:245,Manali:400,Mussoorie:255,Nainital:335,Kasol:355,Chakrata:260,Lansdowne:330,Dalhousie:430,'McLeod Ganj':415,Rishikesh:195,Almora:395,Chail:265 },
  Panipat:       { Shimla:285,Manali:440,Mussoorie:260,Nainital:345,Kasol:395,Chakrata:270,Lansdowne:320,Dalhousie:470,'McLeod Ganj':455,Rishikesh:205,Almora:395,Chail:300 },
  Jaipur:        { Shimla:490,Manali:685,Mussoorie:430,Nainital:455,Kasol:650,Chakrata:460,Lansdowne:415,Dalhousie:755,'McLeod Ganj':735,Rishikesh:395,Almora:490,Chail:470 },
  Jodhpur:       { Shimla:640,Manali:840,Mussoorie:590,Nainital:620,Kasol:805,Chakrata:620,Lansdowne:580,Dalhousie:910,'McLeod Ganj':895,Rishikesh:555,Almora:650,Chail:630 },
  Ajmer:         { Shimla:530,Manali:730,Mussoorie:475,Nainital:500,Kasol:700,Chakrata:505,Lansdowne:460,Dalhousie:800,'McLeod Ganj':785,Rishikesh:440,Almora:535,Chail:510 },
  Kota:          { Shimla:580,Manali:780,Mussoorie:530,Nainital:545,Kasol:745,Chakrata:555,Lansdowne:510,Dalhousie:845,'McLeod Ganj':830,Rishikesh:490,Almora:565,Chail:555 },
  Bikaner:       { Shimla:600,Manali:795,Mussoorie:555,Nainital:575,Kasol:760,Chakrata:575,Lansdowne:535,Dalhousie:845,'McLeod Ganj':830,Rishikesh:520,Almora:600,Chail:575 },
  Alwar:         { Shimla:430,Manali:625,Mussoorie:370,Nainital:395,Kasol:595,Chakrata:400,Lansdowne:360,Dalhousie:695,'McLeod Ganj':680,Rishikesh:335,Almora:430,Chail:415 },
  Agra:          { Shimla:530,Manali:720,Mussoorie:470,Nainital:475,Kasol:685,Chakrata:495,Lansdowne:455,Dalhousie:795,'McLeod Ganj':775,Rishikesh:435,Almora:515,Chail:510 },
  Meerut:        { Shimla:325,Manali:515,Mussoorie:255,Nainital:270,Kasol:475,Chakrata:285,Lansdowne:230,Dalhousie:565,'McLeod Ganj':545,Rishikesh:205,Almora:310,Chail:310 },
  Bareilly:      { Shimla:470,Manali:660,Mussoorie:410,Nainital:240,Kasol:625,Chakrata:425,Lansdowne:320,Dalhousie:730,'McLeod Ganj':710,Rishikesh:290,Almora:270,Chail:460 },
  Lucknow:       { Shimla:750,Manali:960,Mussoorie:695,Nainital:560,Kasol:935,Chakrata:720,Lansdowne:690,Dalhousie:1025,'McLeod Ganj':1005,Rishikesh:645,Almora:580,Chail:735 },
  Kanpur:        { Shimla:710,Manali:905,Mussoorie:650,Nainital:510,Kasol:875,Chakrata:670,Lansdowne:635,Dalhousie:975,'McLeod Ganj':955,Rishikesh:600,Almora:525,Chail:690 },
  Mathura:       { Shimla:440,Manali:635,Mussoorie:385,Nainital:395,Kasol:605,Chakrata:410,Lansdowne:370,Dalhousie:705,'McLeod Ganj':685,Rishikesh:355,Almora:425,Chail:425 },
  Amritsar:      { Shimla:275,Manali:335,Mussoorie:450,Nainital:545,Kasol:285,Chakrata:445,Lansdowne:535,Dalhousie:135,'McLeod Ganj':120,Rishikesh:415,Almora:615,Chail:295 },
  Ludhiana:      { Shimla:200,Manali:290,Mussoorie:360,Nainital:450,Kasol:250,Chakrata:355,Lansdowne:445,Dalhousie:210,'McLeod Ganj':195,Rishikesh:320,Almora:520,Chail:215 },
  Patiala:       { Shimla:175,Manali:320,Mussoorie:310,Nainital:395,Kasol:275,Chakrata:305,Lansdowne:390,Dalhousie:245,'McLeod Ganj':230,Rishikesh:270,Almora:465,Chail:190 },
  Jalandhar:     { Shimla:245,Manali:305,Mussoorie:400,Nainital:495,Kasol:255,Chakrata:395,Lansdowne:490,Dalhousie:175,'McLeod Ganj':160,Rishikesh:365,Almora:565,Chail:260 },
};

function getTypicalTime(origin, destination) {
  if (!origin) return TIMES.Delhi[destination] || 360;
  const key = Object.keys(TIMES).find(k => k.toLowerCase() === origin.toLowerCase());
  if (key && TIMES[key][destination] != null) return TIMES[key][destination];
  return TIMES.Delhi[destination] || 360;
}

module.exports = { getTypicalTime, TIMES };
