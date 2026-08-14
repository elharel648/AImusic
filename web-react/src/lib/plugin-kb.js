// AUTO-EXTRACTED from web/index.html — plugin knowledge base, prescription
// tables, per-plugin walkthroughs, verbatim. EN+HE walkthroughs are written
// in full; other languages read EN (honest, never machine-garbled).
/* eslint-disable */
export const GENRES = ['auto','melodic techno','house','pop','hip-hop','edm','rock','lo-fi'];

export const SUITES={ fabfilter:'FabFilter · Ozone', ableton:'Ableton', fl:'FL Studio', logic:'Logic Pro', free:'Free plugins' };

export const RX_PLUG={
    eq_cut:    { fabfilter:'Pro-Q 3',        ableton:'EQ Eight',          fl:'Parametric EQ 2',        logic:'Channel EQ',       free:'TDR Nova' },
    limiter:   { fabfilter:'Pro-L 2 / Maximizer', ableton:'Limiter',      fl:'Fruity Limiter',         logic:'Adaptive Limiter', free:'Limiter No6' },
    clip:      { fabfilter:'Pro-L 2',        ableton:'Limiter',           fl:'Fruity Limiter',         logic:'Adaptive Limiter', free:'Limiter No6' },
    decompress:{ fabfilter:'Pro-C 2',        ableton:'Compressor',        fl:'Fruity Limiter (Comp)',  logic:'Compressor',       free:'MCompressor' },
    widen:     { fabfilter:'Ozone Imager 2', ableton:'Utility (Width)',   fl:'Fruity Stereo Enhancer', logic:'Direction Mixer',  free:'A1StereoControl' },
    sidechain: { fabfilter:'Pro-C 2 (sidechain)', ableton:'Compressor (sidechain)', fl:'Fruity Limiter (sidechain)', logic:'Compressor (sidechain)', free:'TDR Kotelnikov (SC)' },
    transient: { fabfilter:'Any transient shaper', ableton:'Drum Buss',   fl:'Transient Processor',    logic:'Enveloper',        free:'Flux BitterSweet' },
    deess:     { fabfilter:'Pro-DS',         ableton:'Multiband Dynamics', fl:'Maximus (HF band)',     logic:'DeEsser 2',        free:'TDR Nova (dynamic)' },
  };

export const RX_PARAMS={
    eq_cut:p=>[['Band','Bell'],['Freq',p.freq+' Hz'],['Gain',p.gain_db+' dB'],['Q',String(p.q)]],
    limiter:p=>[['Gain','+'+p.gain_db+' dB'],['Ceiling',p.ceiling_db+' dBTP'],['Target',p.target_lufs+' LUFS']],
    clip:p=>[['Trim',p.trim_db+' dB'],['Ceiling',p.ceiling_db+' dBTP']],
    decompress:p=>[['Ratio','≤ 2:1'],['Now',p.dr_db+' dB DR'],['Aim','≥ '+p.target_dr+' dB DR']],
    widen:p=>[['Width','+15–25%'],['Lows','mono < 120 Hz']],
    sidechain:p=>[['Source','Kick'],['Band',p.freq+' Hz'],['Ratio','3:1'],['Release','fast']],
    transient:p=>[['Attack','+15–20%'],['Sustain','-5%'],['Track','Drums']],
    deess:p=>[['Center',p.freq+' Hz'],['Reduction','3–5 dB'],['Track','Vocal']],
  };

export const DUCKER_PARAMS=p=>[['Mix','80–100%'],['Curve','classic duck'],['Rate','1/4'],['Trigger','on kick']];

export const RX_PARAMS_PLUGIN={
    sidechain:{
      'Kickstart':   DUCKER_PARAMS,
      'LFOTool':     DUCKER_PARAMS,
      'ShaperBox':   DUCKER_PARAMS,                            // VolumeShaper lives inside ShaperBox
      'Trackspacer': p=>[['Amount','~50%'],['Sidechain in','Kick'],['Freq focus',p.freq+' Hz']],
    },
  };

export const RX_ORDER=['eq_cut','deess','sidechain','decompress','transient','widen','clip','limiter'];

export const PLUGIN_KB=[
    // FabFilter
    {n:'Pro-Q 3', a:['proq3','proq','fabfilterq3','q3'], t:{eq_cut:1}},
    {n:'Pro-L 2', a:['prol2','prol','fabfilterl2'], t:{limiter:1,clip:2}},
    {n:'Pro-C 2', a:['proc2','proc','fabfilterc2'], t:{decompress:2,sidechain:1}},
    {n:'Pro-DS', a:['prods','fabfilterds'], t:{deess:1}},
    {n:'Pro-MB', a:['promb','fabfiltermb'], t:{decompress:3,deess:4}},
    {n:'Saturn 2', a:['saturn2','saturn','fabfiltersaturn'], t:{}},                       // saturation — no rx type yet
    // iZotope
    {n:'Ozone Maximizer', a:['ozonemaximizer','ozone','izotopeozone','maximizer'], t:{limiter:1,clip:3}},
    {n:'Ozone Imager', a:['ozoneimager','imager2','imager'], t:{widen:1}},
    {n:'Ozone EQ', a:['ozoneeq','izotopeeq'], t:{eq_cut:2}},
    {n:'Neutron', a:['neutron','izotopeneutron'], t:{eq_cut:4,decompress:4,sidechain:3,transient:3,deess:4}},
    // TDR + free picks
    {n:'TDR Nova', a:['tdrnova','nova'], t:{eq_cut:2,deess:3}},
    {n:'TDR Kotelnikov', a:['tdrkotelnikov','kotelnikov'], t:{decompress:1,sidechain:2}},
    {n:'TDR Limiter 6 GE', a:['tdrlimiter6ge','tdrlimiter6','limiter6ge','limiter6'], t:{limiter:2,clip:1}},
    {n:'Limiter No6', a:['limiterno6','no6','vladglimiter'], t:{limiter:2,clip:2}},
    {n:'OTT', a:['ott','xferott'], t:{}},                                                 // multiband UP-compressor — honest: suits none of these fixes
    // character / space — recognized, no rx type
    {n:'Valhalla VintageVerb', a:['vintageverb','valhallavintageverb'], t:{}},
    {n:'Valhalla Room', a:['valhallaroom'], t:{}},
    {n:'Valhalla Supermassive', a:['supermassive','valhallasupermassive'], t:{}},
    {n:'Soothe2', a:['soothe2','soothe'], t:{deess:2}},
    // Waves
    {n:'CLA-76', a:['cla76','wavescla76','1176'], t:{decompress:4,sidechain:2}},
    {n:'SSL G-Master', a:['sslgmaster','sslcomp','gmasterbuss','sslbuss'], t:{decompress:3}},
    {n:'C6', a:['c6','wavesc6'], t:{deess:4,decompress:4}},
    {n:'L1', a:['l1','wavesl1'], t:{limiter:3,clip:3}},
    {n:'L2', a:['l2','wavesl2'], t:{limiter:2,clip:3}},
    {n:'S1', a:['s1','wavess1','s1imager'], t:{widen:2}},
    {n:'Waves DeEsser', a:['wavesdeesser','deesser'], t:{deess:2}},
    // transient / width specialists
    {n:'Kilohearts Transient Shaper', a:['kiloheartstransientshaper','khstransient','transientshaper'], t:{transient:1}},
    {n:'Smack Attack', a:['smackattack','smack'], t:{transient:1}},
    {n:'BitterSweet', a:['bittersweet','fluxbittersweet'], t:{transient:1}},
    {n:'A1StereoControl', a:['a1stereocontrol','a1stereo','a1'], t:{widen:2}},
    {n:'Wider', a:['wider','polyversewider'], t:{widen:2}},
    {n:'Kickstart', a:['kickstart','nickyromerokickstart'], t:{sidechain:2}},
    {n:'ShaperBox', a:['shaperbox','cableguys','volumeshaper'], t:{sidechain:2,transient:2}},
    // Ableton stock
    {n:'EQ Eight', a:['eqeight','eq8','abletoneq'], t:{eq_cut:3}},
    {n:'Ableton Compressor', a:['abletoncompressor','abletoncomp','livecompressor'], t:{decompress:3,sidechain:2}},
    {n:'Ableton Limiter', a:['abletonlimiter','livelimiter'], t:{limiter:3,clip:3}},
    {n:'Utility', a:['utility','abletonutility'], t:{widen:3}},
    {n:'Drum Buss', a:['drumbuss','drumbus'], t:{transient:3}},
    {n:'Multiband Dynamics', a:['multibanddynamics','abletonmultiband'], t:{deess:5,decompress:4}},
    // FL Studio stock
    {n:'Parametric EQ 2', a:['parametriceq2','parametriceq','flparametriceq','fleq'], t:{eq_cut:3}},
    {n:'Fruity Limiter', a:['fruitylimiter','fllimiter'], t:{limiter:3,clip:3,decompress:4,sidechain:2}},
    {n:'Maximus', a:['maximus','flmaximus'], t:{limiter:3,deess:5,decompress:4}},
    {n:'Transient Processor', a:['transientprocessor','fltransient'], t:{transient:2}},
    {n:'Fruity Stereo Enhancer', a:['fruitystereoenhancer','flstereoenhancer'], t:{widen:3}},
    // Logic Pro stock
    {n:'Channel EQ', a:['channeleq','logiceq','garagebandeq','gbchanneleq'], t:{eq_cut:3}},   // Logic + GarageBand
    {n:'Logic Compressor', a:['logiccompressor','logiccomp','garagebandcompressor','gbcompressor'], t:{decompress:3,sidechain:2}},
    {n:'Adaptive Limiter', a:['adaptivelimiter','logiclimiter'], t:{limiter:3,clip:3}},
    {n:'DeEsser 2', a:['deesser2','logicdeesser'], t:{deess:1}},
    {n:'Enveloper', a:['enveloper','logicenveloper'], t:{transient:2}},
    {n:'Direction Mixer', a:['directionmixer','logicdirectionmixer'], t:{widen:3}},
    // Waves — the rest of the lineup people actually own
    {n:'CLA-2A', a:['cla2a','wavescla2a'], t:{decompress:4}},
    {n:'CLA-3A', a:['cla3a','wavescla3a'], t:{decompress:4}},
    {n:'RCompressor', a:['rcompressor','rcomp','renaissancecompressor','wavesrcomp'], t:{decompress:3,sidechain:3}},
    {n:'RVox', a:['rvox','renaissancevox','wavesrvox'], t:{decompress:5}},
    {n:'RBass', a:['rbass','renaissancebass','wavesrbass'], t:{}},                        // bass harmonics — no rx type
    {n:'REQ', a:['renaissanceeq','wavesreq'], t:{eq_cut:3}},
    {n:'Q10', a:['q10','wavesq10'], t:{eq_cut:3}},
    {n:'H-Comp', a:['hcomp','waveshcomp','hybridcompressor'], t:{decompress:3,sidechain:3}},
    {n:'F6', a:['f6','wavesf6','f6dynamiceq'], t:{eq_cut:2,deess:3}},
    {n:'Vitamin', a:['vitamin','wavesvitamin'], t:{}},                                    // multiband enhancer — no rx type
    {n:'Center', a:['center','wavescenter'], t:{widen:2}},
    {n:'Waves Sibilance', a:['sibilance','wavessibilance'], t:{deess:2}},
    {n:'C4', a:['c4','wavesc4'], t:{decompress:4,deess:5}},
    {n:'L3', a:['l3','wavesl3','l3multimaximizer'], t:{limiter:2,clip:3}},
    {n:'PuigTec EQP-1A', a:['puigtec','puigteceqp1a','eqp1a'], t:{eq_cut:4}},             // tone EQ, not surgical
    {n:'API 2500', a:['api2500','wavesapi2500'], t:{decompress:3}},
    {n:'SSL E-Channel', a:['sslechannel','wavessslechannel','sslevchannel'], t:{eq_cut:4,decompress:4,deess:5}},
    {n:'SSL G-Channel', a:['sslgchannel','wavessslgchannel'], t:{eq_cut:4,decompress:4,deess:5}},
    {n:'Scheps Omni Channel', a:['schepsomnichannel','omnichannel','scheps'], t:{eq_cut:4,decompress:4,deess:4}},
    {n:'MaxxBass', a:['maxxbass','wavesmaxxbass'], t:{}},
    {n:'MV2', a:['mv2','wavesmv2'], t:{decompress:5}},
    // UAD
    {n:'UAD 1176', a:['uad1176','ua1176','uad1176ln'], t:{decompress:4,sidechain:3}},
    {n:'UAD LA-2A', a:['la2a','uadla2a','teletronixla2a'], t:{decompress:4}},
    {n:'UAD Precision Limiter', a:['precisionlimiter','uadprecisionlimiter'], t:{limiter:2,clip:3}},
    {n:'UAD SSL G Bus Compressor', a:['uadsslbus','uadsslgbus','uadbuscompressor'], t:{decompress:3}},
    {n:'UAD Pultec EQP-1A', a:['pultec','uadpultec'], t:{eq_cut:4}},
    {n:'UAD Fairchild 670', a:['fairchild','fairchild670','uadfairchild'], t:{decompress:3}},
    // Slate Digital
    {n:'FG-X', a:['fgx','slatefgx','fgx2'], t:{limiter:2,clip:2}},
    {n:'VMR', a:['vmr','virtualmixrack','slatevmr'], t:{eq_cut:4,decompress:4}},
    {n:'FG-N', a:['fgn','slatefgn'], t:{eq_cut:4}},
    {n:'FG-S', a:['fgs','slatefgs'], t:{eq_cut:3}},
    {n:'FG-116', a:['fg116','slatefg116'], t:{decompress:4,sidechain:3}},
    {n:'FG-401', a:['fg401','slatefg401'], t:{decompress:3,sidechain:3}},
    {n:'FG-MU', a:['fgmu','slatefgmu'], t:{decompress:2}},
    {n:'Revival', a:['revival','slaterevival'], t:{}},
    // Plugin Alliance / Brainworx
    {n:'bx_digital V3', a:['bxdigital','bxdigitalv3'], t:{eq_cut:2,widen:2,deess:3}},
    {n:'Shadow Hills Mastering Compressor', a:['shadowhills','shadowhillsmasteringcompressor'], t:{decompress:2}},
    {n:'Elysia mpressor', a:['mpressor','elysiampressor'], t:{decompress:2,transient:3}},
    {n:'bx_masterdesk', a:['bxmasterdesk','masterdesk'], t:{limiter:3,decompress:4}},
    {n:'bx_limiter True Peak', a:['bxlimiter','bxlimitertruepeak'], t:{limiter:2,clip:2}},
    {n:'Maag EQ4', a:['maageq4','maag'], t:{eq_cut:4}},                                   // air shelf — tone, not surgery
    {n:'SPL Transient Designer Plus', a:['transientdesigner','spltransientdesigner','transientdesignerplus'], t:{transient:1}},
    {n:'bx_townhouse', a:['bxtownhouse','townhouse'], t:{decompress:3}},
    // Softube
    {n:'Tube-Tech CL 1B', a:['cl1b','tubetechcl1b','tubetech'], t:{decompress:3}},
    {n:'Softube FET Compressor', a:['fetcompressor','softubefet'], t:{decompress:4,sidechain:3}},
    {n:'Softube Saturation Knob', a:['saturationknob','softubesaturationknob'], t:{}},
    // Weiss (Softube)
    {n:'Weiss DS1-MK3', a:['weissds1','ds1mk3','weissds1mk3'], t:{deess:1,limiter:2,decompress:2}},
    {n:'Weiss MM-1', a:['weissmm1','mm1'], t:{limiter:2}},
    {n:'Weiss EQ1', a:['weisseq1','eq1'], t:{eq_cut:2}},
    // sidechain / movement specialists
    {n:'LFOTool', a:['lfotool','xferlfotool'], t:{sidechain:2}},
    {n:'Trackspacer', a:['trackspacer','wavesfactorytrackspacer'], t:{sidechain:1}},      // spectral ducking — the specialist
    // iZotope — Neutron modules + friends
    {n:'Neutron EQ', a:['neutroneq'], t:{eq_cut:3}},
    {n:'Neutron Compressor', a:['neutroncompressor','neutroncomp'], t:{decompress:3,sidechain:3}},
    {n:'Neutron Transient Shaper', a:['neutrontransientshaper','neutrontransient'], t:{transient:2}},
    {n:'Neutron Exciter', a:['neutronexciter'], t:{}},
    {n:'Nectar', a:['nectar','izotopenectar'], t:{deess:3,decompress:4}},
    {n:'iZotope RX', a:['izotoperx','rxstandard','rxadvanced'], t:{}},                    // repair suite — different job
    {n:'Insight', a:['insight','izotopeinsight'], t:{}},                                  // metering only
    // Melda (free bundle staples)
    {n:'MEqualizer', a:['mequalizer','meldaeq'], t:{eq_cut:3}},
    {n:'MCompressor', a:['mcompressor','meldacompressor'], t:{decompress:3,sidechain:3}},
    {n:'MStereoExpander', a:['mstereoexpander','meldastereo'], t:{widen:2}},
    {n:'MAnalyzer', a:['manalyzer'], t:{}},                                               // analyzer — measures, fixes nothing
    {n:'MAutoPitch', a:['mautopitch'], t:{}},
    // Klanghelm
    {n:'MJUC', a:['mjuc','klanghelmmjuc'], t:{decompress:2}},
    {n:'DC1A', a:['dc1a','klanghelmdc1a'], t:{decompress:3}},
    {n:'SDRR', a:['sdrr','klanghelmsdrr'], t:{}},
    {n:'IVGI', a:['ivgi','klanghelmivgi'], t:{}},
    // Voxengo
    {n:'SPAN', a:['span','voxengospan'], t:{}},                                           // analyzer — no rx type
    {n:'Elephant', a:['elephant','voxengoelephant'], t:{limiter:1,clip:2}},
    {n:'MSED', a:['msed','voxengomsed'], t:{widen:2}},
    // DMG Audio
    {n:'Limitless', a:['limitless','dmglimitless'], t:{limiter:1,clip:2}},
    {n:'EQuilibrium', a:['equilibrium','dmgequilibrium'], t:{eq_cut:1}},
    {n:'Essence', a:['essence','dmgessence'], t:{deess:1}},
    {n:'TrackComp', a:['trackcomp','dmgtrackcomp'], t:{decompress:2,sidechain:2}},
    // Sonnox Oxford
    {n:'Oxford Limiter', a:['oxfordlimiter','sonnoxlimiter'], t:{limiter:1,clip:2}},
    {n:'Oxford Inflator', a:['inflator','oxfordinflator','sonnoxinflator'], t:{}},        // loudness tone-box — not a true-peak limiter
    {n:'Oxford Dynamics', a:['oxforddynamics','sonnoxdynamics'], t:{decompress:3,sidechain:3}},
    {n:'Oxford EQ', a:['oxfordeq','sonnoxeq'], t:{eq_cut:2}},
    {n:'Oxford SuprEsser', a:['supresser','oxfordsupresser','sonnoxsupresser'], t:{deess:1}},
    // sonible / modern specialists
    {n:'smart:limit', a:['smartlimit','soniblesmartlimit'], t:{limiter:2}},
    {n:'smart:comp 2', a:['smartcomp','smartcomp2','soniblesmartcomp'], t:{decompress:3,sidechain:3}},
    {n:'smart:EQ 4', a:['smarteq','smarteq4','soniblesmarteq'], t:{eq_cut:2}},
    {n:'oeksound spiff', a:['spiff','oeksoundspiff'], t:{transient:1,deess:2}},
    {n:'Newfangled Elevate', a:['elevate','newfangledelevate'], t:{limiter:2,transient:2}},
    {n:'Pulsar Mu', a:['pulsarmu','pulsaraudiomu'], t:{decompress:2}},
    // Soundtoys — recognized, no rx type (color, not correction)
    {n:'Decapitator', a:['decapitator','soundtoysdecapitator'], t:{}},
    {n:'EchoBoy', a:['echoboy','soundtoysechoboy'], t:{}},
    // FabFilter — rest of the bundle (recognized)
    {n:'Pro-R 2', a:['pror2','pror','fabfilterreverb'], t:{}},
    {n:'Pro-G', a:['prog','fabfiltergate'], t:{}},
    {n:'Timeless 3', a:['timeless3','timeless','fabfiltertimeless'], t:{}},
    // more free classics
    {n:'TDR VOS SlickEQ', a:['slickeq','tdrslickeq'], t:{eq_cut:3}},
    {n:'W1 Limiter', a:['w1limiter','w1','yohngw1'], t:{limiter:3,clip:3}},
    {n:'Youlean Loudness Meter', a:['youlean','youleanloudnessmeter','ylm'], t:{}},       // meter — no rx type
    // Cubase stock
    {n:'StudioEQ', a:['studioeq','cubaseeq','cubasestudioeq'], t:{eq_cut:3}},
    {n:'Frequency 2', a:['frequency','frequency2','cubasefrequency'], t:{eq_cut:2}},
    {n:'Cubase Compressor', a:['cubasecompressor','cubasecomp'], t:{decompress:3,sidechain:2}},
    {n:'Brickwall Limiter', a:['brickwalllimiter','cubaselimiter','brickwall'], t:{limiter:3,clip:3}},
    {n:'Envelope Shaper', a:['envelopeshaper','cubaseenvelopeshaper'], t:{transient:2}},
    {n:'Cubase DeEsser', a:['cubasedeesser'], t:{deess:2}},
    {n:'Cubase Maximizer', a:['cubasemaximizer'], t:{limiter:3}},
    // Studio One stock
    {n:'Pro EQ', a:['proeq','proeq3','studiooneeq','presonusproeq'], t:{eq_cut:3}},
    {n:'Limiter2', a:['limiter2','studioonelimiter','presonuslimiter'], t:{limiter:3,clip:3}},
    {n:'Studio One Compressor', a:['studioonecompressor','presonuscompressor'], t:{decompress:3,sidechain:2}},
    // Reaper stock
    {n:'ReaEQ', a:['reaeq'], t:{eq_cut:3}},
    {n:'ReaComp', a:['reacomp'], t:{decompress:3,sidechain:2}},
    {n:'ReaLimit', a:['realimit'], t:{limiter:3,clip:3}},
    {n:'ReaXcomp', a:['reaxcomp'], t:{decompress:4,deess:5}},
    // Bitwig stock
    {n:'EQ+', a:['eqplus','bitwigeq'], t:{eq_cut:3}},
    {n:'Peak Limiter', a:['peaklimiter','bitwiglimiter'], t:{limiter:3,clip:3}},
    {n:'Compressor+', a:['compressorplus','bitwigcompressor'], t:{decompress:3,sidechain:2}},
    // more stock — Ableton / Logic / FL
    {n:'Glue Compressor', a:['gluecompressor','glue','abletonglue'], t:{decompress:2,sidechain:2}},
    {n:'Saturator', a:['saturator','abletonsaturator'], t:{}},
    {n:'Multipressor', a:['multipressor','logicmultipressor'], t:{decompress:4,deess:5}},
    {n:'Fruity Compressor', a:['fruitycompressor','flcompressor'], t:{decompress:4}},
    {n:'Soundgoodizer', a:['soundgoodizer'], t:{}},                                       // one-knob polish — honest: not a fix tool
  ];

export const SUITE_SEED={
    fabfilter:['Pro-Q 3','Pro-L 2','Pro-C 2','Pro-DS','Pro-MB','Saturn 2','Ozone Maximizer','Ozone Imager'],
    ableton:['EQ Eight','Ableton Compressor','Ableton Limiter','Utility','Drum Buss','Multiband Dynamics'],
    fl:['Parametric EQ 2','Fruity Limiter','Maximus','Transient Processor','Fruity Stereo Enhancer'],
    logic:['Channel EQ','Logic Compressor','Adaptive Limiter','DeEsser 2','Enveloper','Direction Mixer'],
    free:['TDR Nova','TDR Kotelnikov','Limiter No6','BitterSweet','A1StereoControl'],
  };

export const WALKTHROUGHS={
    'Pro-Q 3':{eq_cut:{
      en:["Open Pro-Q 3 on the muddy track (or the mix bus) and double-click the curve display near {freq} Hz to create a band.",
          "Drag the band to exactly {freq} Hz — or double-click its frequency readout and type {freq}.",
          "Pull the band down to {gain_db} dB.",
          "Set Q to {q} (scroll on the band dot, or type it in the Q field).",
          "Toggle the bypass a few times — the mud should lift without the mix going thin."],
      he:["פתח את Pro-Q 3 על הערוץ הבוצי (או על המאסטר) ולחץ לחיצה כפולה על התצוגה באזור {freq} Hz כדי ליצור באנד.",
          "גרור את הבאנד בדיוק ל־{freq} Hz — או לחץ לחיצה כפולה על שדה התדר והקלד {freq}.",
          "הורד את הבאנד ל־{gain_db} dB.",
          "כוון את ה־Q ל־{q} (גלגלת על נקודת הבאנד, או הקלדה בשדה ה־Q).",
          "הפעל וכבה bypass כמה פעמים — הבוץ אמור להתפנות בלי שהמיקס יישמע דק."]}},
    'EQ Eight':{eq_cut:{
      en:["Drop EQ Eight on the muddy track and switch on a free filter band.",
          "Set that band's filter type to Bell.",
          "Click the Freq value and type {freq} Hz.",
          "Set Gain to {gain_db} dB.",
          "Set Q to {q}.",
          "A/B with the device on/off switch — cleaner, not thinner."],
      he:["זרוק EQ Eight על הערוץ הבוצי והדלק באנד פנוי.",
          "בחר לבאנד סוג פילטר Bell.",
          "לחץ על ערך ה־Freq והקלד {freq} Hz.",
          "כוון Gain ל־{gain_db} dB.",
          "כוון Q ל־{q}.",
          "השווה עם מתג ההפעלה של המכשיר — נקי יותר, לא דק יותר."]}},
    'Parametric EQ 2':{eq_cut:{
      en:["Drop Parametric EQ 2 on the muddy track and grab one of the numbered band tokens.",
          "Drag it to {freq} Hz and down to {gain_db} dB — the readout shows exact values while you drag.",
          "Tighten the bandwidth (BW) until the dip is roughly a Q of {q} — narrower BW = higher Q.",
          "Make sure the band type is Peaking (the default for the middle bands).",
          "Compare against bypass — the boxiness should open up."],
      he:["זרוק Parametric EQ 2 על הערוץ הבוצי ותפוס אחד מהטוקנים הממוספרים.",
          "גרור אותו ל־{freq} Hz ולמטה ל־{gain_db} dB — הקריאה מציגה ערכים מדויקים תוך כדי גרירה.",
          "הצר את ה־Bandwidth (BW) עד שהחתך ברוחב של בערך Q {q} — BW צר יותר = Q גבוה יותר.",
          "ודא שסוג הבאנד הוא Peaking (ברירת המחדל לבאנדים האמצעיים).",
          "השווה מול bypass — הבוקסיות אמורה להיפתח."]}},
    'Channel EQ':{eq_cut:{
      en:["Insert Channel EQ on the muddy track and pick one of the middle bell bands.",
          "Click the frequency value under the display and type {freq}.",
          "Set that band's Gain to {gain_db} dB.",
          "Set Q to {q}.",
          "Turn on the Analyzer to see the dip you made, then bypass-compare."],
      he:["הכנס Channel EQ על הערוץ הבוצי ובחר אחד מבאנדי ה־Bell האמצעיים.",
          "לחץ על ערך התדר מתחת לתצוגה והקלד {freq}.",
          "כוון את ה־Gain של הבאנד ל־{gain_db} dB.",
          "כוון Q ל־{q}.",
          "הדלק את ה־Analyzer כדי לראות את החתך שעשית, ואז השווה מול bypass."]}},
    'TDR Nova':{
      eq_cut:{
      en:["Insert TDR Nova and click a node in the display to activate a band.",
          "Set its frequency to {freq} Hz, gain to {gain_db} dB and Q to {q} — click any readout to type exact values.",
          "Leave the band's threshold section off — this is a static cut, no dynamics needed.",
          "Use the bypass button to A/B."],
      he:["הכנס TDR Nova ולחץ על נקודה בתצוגה כדי להפעיל באנד.",
          "כוון תדר {freq} Hz, גיין {gain_db} dB ו־Q {q} — לחיצה על כל קריאה מאפשרת הקלדה מדויקת.",
          "השאר את מקטע ה־Threshold של הבאנד כבוי — זה חתך סטטי, בלי דינמיקה.",
          "השתמש בכפתור ה־bypass כדי להשוות."]},
      deess:{
      en:["Insert Nova on the vocal track and activate a band around {freq} Hz.",
          "Widen it slightly — a Q around 2–3 covers the whole sibilant range.",
          "In that band's dynamics section, engage the threshold and pull it down until esses trigger 3–5 dB of gain reduction.",
          "Keep the band's static gain at 0 dB — let the dynamic threshold do the work.",
          "Play the loudest chorus: reduction should flicker only on S and T sounds."],
      he:["הכנס Nova על ערוץ הווקאל והפעל באנד סביב {freq} Hz.",
          "הרחב מעט — Q בסביבות 2–3 מכסה את כל טווח הסיבילנס.",
          "במקטע הדינמיקה של הבאנד, הפעל את ה־Threshold והורד אותו עד שה־S־ים מפעילים הפחתה של 3–5 dB.",
          "השאר את הגיין הסטטי של הבאנד על 0 dB — תן ל־Threshold הדינמי לעבוד.",
          "נגן את הפזמון הכי חזק: ההפחתה צריכה להבהב רק על צלילי S ו־T."]}},
    'Pro-L 2':{limiter:{
      en:["Put Pro-L 2 last on your master bus, after any EQ.",
          "Set the output level to {ceiling_db} dBTP and turn oversampling to 4x so inter-sample peaks are caught.",
          "Pick a style — Modern is a safe default for electronic mixes.",
          "Raise the main gain by about +{gain_db} dB, until the loudness readout sits near {target_lufs} LUFS.",
          "Watch the gain-reduction display on the loudest section — more than ~3 dB of constant reduction means back off and fix the mix first."],
      he:["שים את Pro-L 2 אחרון על ערוץ המאסטר, אחרי כל EQ.",
          "כוון את ה־Output ל־{ceiling_db} dBTP והעלה oversampling ל־4x כדי לתפוס פיקים בין־דגימות.",
          "בחר סגנון — Modern הוא ברירת מחדל בטוחה למיקסים אלקטרוניים.",
          "הרם את הגיין הראשי בערך +{gain_db} dB, עד שמד הלאודנס יושב סביב {target_lufs} LUFS.",
          "שים עין על ה־gain reduction בקטע הכי חזק — יותר מ־3 dB קבועים? תרד, ותקן קודם את המיקס."]}},
    'L2':{limiter:{
      en:["Put L2 last on the master bus.",
          "Set Out Ceiling to {ceiling_db} dB.",
          "Pull Threshold down by about {gain_db} dB — every dB of threshold adds a dB of loudness.",
          "Check the result on a LUFS meter after L2 — aim for about {target_lufs} LUFS.",
          "Keep the Atten meter under ~3 dB on the loudest hits; if it slams, ease the threshold back."],
      he:["שים את L2 אחרון על ערוץ המאסטר.",
          "כוון Out Ceiling ל־{ceiling_db} dB.",
          "הורד את ה־Threshold בערך {gain_db} dB — כל dB של threshold מוסיף dB של עוצמה.",
          "בדוק על מד LUFS אחרי ה־L2 — כוון לסביבות {target_lufs} LUFS.",
          "שמור את מד ה־Atten מתחת ל־3 dB בהיטים הכי חזקים; אם הוא נמחץ — שחרר את ה־Threshold."]}},
    'Limiter No6':{limiter:{
      en:["Put Limiter No6 last on the master bus.",
          "Switch on the ISP protection stage (the last module) and set its ceiling to {ceiling_db} dB — it catches inter-sample peaks.",
          "Use the peak limiter section for the loudness: raise its input gain by about +{gain_db} dB.",
          "No6 meters in dB only — read LUFS on a meter after it (SPAN or Youlean, both free) and aim for {target_lufs} LUFS.",
          "If it starts pumping, let the RMS compressor stage take the first 1–2 dB instead."],
      he:["שים את Limiter No6 אחרון על ערוץ המאסטר.",
          "הפעל את שלב ה־ISP protection (המודול האחרון) וכוון את התקרה שלו ל־{ceiling_db} dB — הוא תופס פיקים בין־דגימות.",
          "את העוצמה עושים במקטע ה־peak limiter: הרם את גיין הכניסה שלו בערך +{gain_db} dB.",
          "No6 מודד רק dB — קרא LUFS על מד אחריו (SPAN או Youlean, שניהם חינמיים) וכוון ל־{target_lufs} LUFS.",
          "אם מתחיל פאמפינג, תן לשלב ה־RMS compressor לקחת את ה־1–2 dB הראשונים במקום."]}},
    'Fruity Limiter':{
      limiter:{
      en:["Drop Fruity Limiter in the last slot of the Master mixer track and stay on the LIMIT tab.",
          "Set CEIL to {ceiling_db} dB.",
          "Raise GAIN by about +{gain_db} dB, watching the gain-reduction curve at the top.",
          "Read loudness on a LUFS meter after it (Youlean is free) — target {target_lufs} LUFS.",
          "If the curve is constantly slammed, back GAIN off — loudness that never breathes just sounds small."],
      he:["זרוק Fruity Limiter בסלוט האחרון של ערוץ המאסטר במיקסר, והישאר בלשונית LIMIT.",
          "כוון CEIL ל־{ceiling_db} dB.",
          "הרם את GAIN בערך +{gain_db} dB, תוך מבט על עקומת ה־gain reduction למעלה.",
          "קרא לאודנס על מד LUFS אחריו (Youlean חינמי) — יעד {target_lufs} LUFS.",
          "אם העקומה נמחצת כל הזמן — הורד את ה־GAIN. עוצמה שלא נושמת נשמעת קטנה."]},
      sidechain:{
      en:["In the Mixer, click the kick's track, then right-click the arrow at the bottom of the bass track and choose \"Sidechain to this track\".",
          "Drop Fruity Limiter on the bass track and switch to the COMP tab.",
          "Set SIDECHAIN to 1 — the kick feed you just created.",
          "Set RATIO around 4:1 and lower THRES until the bass ducks a few dB on each kick.",
          "Keep REL fast (~60–100 ms) so the {freq} Hz region gets out of the kick's way and back before the next hit."],
      he:["במיקסר, סמן את ערוץ הקיק, ואז קליק ימני על החץ בתחתית ערוץ הבס ובחר \"Sidechain to this track\".",
          "זרוק Fruity Limiter על ערוץ הבס ועבור ללשונית COMP.",
          "כוון SIDECHAIN ל־1 — הזנת הקיק שיצרת עכשיו.",
          "כוון RATIO בסביבות 4:1 והורד את THRES עד שהבס צולל כמה dB על כל קיק.",
          "שמור REL מהיר (60–100 ms) כך שאזור ה־{freq} Hz מפנה מקום לקיק וחוזר לפני המכה הבאה."]}},
    'Adaptive Limiter':{limiter:{
      en:["Insert Adaptive Limiter last on the Stereo Out, after any EQ.",
          "Set Out Ceiling to {ceiling_db} dB and enable True Peak Detection.",
          "Raise Gain by about +{gain_db} dB.",
          "Add Logic's Loudness Meter after it and aim for {target_lufs} LUFS integrated.",
          "If the drums start smearing, pull Gain back — the last dB is rarely worth it."],
      he:["הכנס Adaptive Limiter אחרון על ה־Stereo Out, אחרי כל EQ.",
          "כוון Out Ceiling ל־{ceiling_db} dB והפעל True Peak Detection.",
          "הרם את ה־Gain בערך +{gain_db} dB.",
          "הוסף את ה־Loudness Meter של Logic אחריו וכוון ל־{target_lufs} LUFS Integrated.",
          "אם התופים מתחילים להימרח — הורד את הגיין. ה־dB האחרון כמעט אף פעם לא שווה את זה."]}},
    'Ableton Compressor':{sidechain:{
      en:["Drop Compressor on the bass track and unfold the sidechain panel (the triangle in the title bar).",
          "Turn Sidechain on and set Audio From to the kick track.",
          "Use the headphone (listen) button once to confirm you're keying off the kick, then switch it off.",
          "Set Ratio around 4:1, fast Attack, Release around 100 ms.",
          "Lower Threshold until each kick pulls the bass down a few dB — the {freq} Hz zone should stop fighting the kick."],
      he:["זרוק Compressor על ערוץ הבס ופתח את פאנל הסיידצ׳יין (המשולש בכותרת המכשיר).",
          "הפעל Sidechain וכוון Audio From לערוץ הקיק.",
          "השתמש רגע בכפתור האוזניות (listen) כדי לוודא שאתה מקבל את הקיק, ואז כבה אותו.",
          "כוון Ratio בסביבות 4:1, Attack מהיר, Release בסביבות 100 ms.",
          "הורד את ה־Threshold עד שכל קיק מוריד את הבס כמה dB — אזור ה־{freq} Hz צריך להפסיק להילחם בקיק."]}},
    'Logic Compressor':{sidechain:{
      en:["Insert Compressor on the bass track.",
          "In the plugin header, open the Side Chain menu (top right) and choose the kick track.",
          "Set Ratio around 4:1, fast Attack, Release around 100 ms — Platinum Digital is the cleanest circuit for ducking.",
          "Lower Threshold until the gain-reduction meter dips a few dB on every kick.",
          "Bypass-compare: the low end around {freq} Hz should sound tighter, not quieter."],
      he:["הכנס Compressor על ערוץ הבס.",
          "בכותרת הפלאגין, פתח את תפריט ה־Side Chain (למעלה מימין) ובחר את ערוץ הקיק.",
          "כוון Ratio בסביבות 4:1, Attack מהיר, Release בסביבות 100 ms — Platinum Digital הוא המעגל הכי נקי לדאקינג.",
          "הורד את ה־Threshold עד שמד ה־gain reduction צולל כמה dB על כל קיק.",
          "השווה מול bypass: הלואו־אנד סביב {freq} Hz צריך להישמע הדוק יותר, לא שקט יותר."]}},
    'Pro-DS':{deess:{
      en:["Insert Pro-DS on the vocal track, before any reverb or delay sends.",
          "Set the mode to Single Vocal.",
          "Use Audition to hear what's being detected and center the side-chain filter around {freq} Hz.",
          "Lower Threshold until only esses light up the detection — aim for 3–5 dB of reduction.",
          "Cap Range at about 5 dB so it can never dull the whole vocal."],
      he:["הכנס Pro-DS על ערוץ הווקאל, לפני הסנדים לריוורב או דיליי.",
          "כוון את המצב ל־Single Vocal.",
          "השתמש ב־Audition כדי לשמוע מה מזוהה, ומרכז את פילטר הסיידצ׳יין סביב {freq} Hz.",
          "הורד את ה־Threshold עד שרק ה־S־ים מדליקים את הזיהוי — כוון ל־3–5 dB הפחתה.",
          "הגבל את ה־Range לבערך 5 dB כדי שלעולם לא יעמעם את כל הווקאל."]}},
    'DeEsser 2':{deess:{
      en:["Insert DeEsser 2 on the vocal track.",
          "Set Frequency to {freq} Hz.",
          "Turn on Filter Solo to hear exactly the band being tamed, then turn it off.",
          "Lower Threshold until esses trigger 3–5 dB of reduction.",
          "Keep reduction around 3–5 dB even on the loudest lines — more starts to lisp."],
      he:["הכנס DeEsser 2 על ערוץ הווקאל.",
          "כוון Frequency ל־{freq} Hz.",
          "הפעל Filter Solo כדי לשמוע בדיוק את הפס שמרוסן, ואז כבה.",
          "הורד את ה־Threshold עד שה־S־ים מפעילים הפחתה של 3–5 dB.",
          "שמור על הפחתה של 3–5 dB גם בשורות החזקות — יותר מזה מתחיל להישמע כמו ליספ."]}},
    'BitterSweet':{transient:{
      en:["Drop BitterSweet on the drum bus.",
          "Turn the big central knob toward Bitter — that pushes transients forward. Start around +15–20%.",
          "Leave the mode on Main; set the transient Speed to Fast for drums.",
          "A/B with the power switch, and watch the limiter after it — sharper attacks eat headroom."],
      he:["זרוק BitterSweet על באס התופים.",
          "סובב את הכפתור המרכזי הגדול לכיוון Bitter — זה דוחף את הטרנזיינטים קדימה. התחל סביב +15–20%.",
          "השאר את המצב על Main; כוון את ה־Speed ל־Fast לתופים.",
          "השווה עם מתג ההפעלה, ושים עין על הלימיטר שאחריו — אטאקים חדים אוכלים headroom."]}},
    'Drum Buss':{transient:{
      en:["Group the drums and drop Drum Buss on the group.",
          "Raise the Transients knob — around 15–20% brings the attack forward without dirt.",
          "Keep Crunch and Boom at zero unless you want distortion or sub — this fix is about punch.",
          "Level-match with Trim, then A/B with the device switch."],
      he:["קבץ את התופים וזרוק Drum Buss על הקבוצה.",
          "הרם את כפתור ה־Transients — בסביבות 15–20% האטאק יוצא קדימה בלי לכלוך.",
          "השאר Crunch ו־Boom על אפס אלא אם אתה רוצה עיוות או סאב — התיקון הזה הוא על פאנץ׳.",
          "אזן ווליום עם Trim, ואז השווה עם מתג המכשיר."]}},
    'Kickstart':{sidechain:{
      en:["Drop Kickstart on the bass track — not on the kick.",
          "Choose the classic duck curve and set Rate to 1/4 so it dips on every beat.",
          "Turn the Mix knob up to 80–100% — that's the depth of the duck.",
          "Pick the curve whose recovery lands just before the next kick, so the {freq} Hz region gets back in time.",
          "A/B with bypass — kick and bass should take turns, not fight."],
      he:["זרוק Kickstart על ערוץ הבס — לא על הקיק.",
          "בחר את עקומת הדאק הקלאסית וכוון Rate ל־1/4 כך שהוא צולל על כל ביט.",
          "הרם את כפתור ה־Mix ל־80–100% — זה עומק הדאק.",
          "בחר עקומה שההתאוששות שלה נוחתת רגע לפני הקיק הבא — כך אזור ה־{freq} Hz חוזר בזמן.",
          "השווה מול bypass — הקיק והבס אמורים להתחלף, לא להילחם."]}},
    'Trackspacer':{sidechain:{
      en:["Insert Trackspacer on the bass track.",
          "Route the kick into Trackspacer's sidechain input (your DAW's plugin sidechain menu).",
          "Raise Amount to around 50% — it carves the kick's frequencies out of the bass in real time.",
          "Use the built-in low/high filters to focus the carving around {freq} Hz.",
          "A/B: the kick should punch through without the bass dropping in level."],
      he:["הכנס Trackspacer על ערוץ הבס.",
          "נתב את הקיק לכניסת הסיידצ׳יין של Trackspacer (תפריט הסיידצ׳יין של הפלאגין ב־DAW).",
          "הרם את ה־Amount לבערך 50% — הוא מפנה את התדרים של הקיק מתוך הבס בזמן אמת.",
          "השתמש בפילטרים המובנים כדי למקד את הפינוי סביב {freq} Hz.",
          "השווה: הקיק אמור לחתוך החוצה בלי שהבס יורד בווליום."]}},
  };
