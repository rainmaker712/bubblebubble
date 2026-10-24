/** Original pixel artwork inspired by the arcade reference; player art lives separately. */
export function drawArcadeArt(c: CanvasRenderingContext2D, key: string, w: number, h: number, accent = '#ff5ca8', secondary = '#ffdc59'): void {
  const ink = '#140e29', white = '#fff9df';
  const rect = (x: number, y: number, width: number, height: number, color: string) => { c.fillStyle = color; c.fillRect(x, y, width, height); };
  const grid = (rows: string[], palette: Record<string, string>, scale = 2, ox = 0, oy = 0) => rows.forEach((row, y) => [...row].forEach((pixel, x) => { if (palette[pixel]) rect(ox + x * scale, oy + y * scale, scale, scale, palette[pixel]); }));
  const orb = (color: string, filled = false) => {
    for (let y = 1; y < 13; y++) for (let x = 1; x < 13; x++) {
      const d = Math.hypot(x - 6.5, y - 6.5);
      if (d < 6 && (filled || d > 4.6)) rect(x * 2, y * 2, 2, 2, d > 5 ? color : filled ? '#273053' : '#fff9df');
    }
    rect(6, 6, 4, 4, white); rect(10, 4, 4, 2, white);
  };
  const bolt = (ox: number, oy: number, scale = 2) => grid(['...YYY','..YYY.','.YYY..','YYYYYY','...YY.','..YY..','.YY...','YY....'], {Y:'#ffe653'}, scale, ox, oy);
  const flame = (ox: number, oy: number, scale = 2) => grid(['....R....','...RR....','...RYR...','.R.RYR...','.RRYRYR..','RRYYYYRR.','RYYWWYYR.','.RYWWYR..','..RYYR...','...RR....'],{R:'#ff543e',Y:'#ffbe35',W:'#fff9b3'},scale,ox,oy);
  if (key.startsWith('platform')) {
    rect(0,0,w,h,ink); rect(1,1,w-2,h-2,accent);
    for(let y=0;y<2;y++) for(let x=-1;x<2;x++) {
      const bx=x*20+(y%2)*10, by=y*16;
      rect(bx+2,by+2,17,12,accent); rect(bx+2,by+2,17,2,secondary);
      rect(bx+2,by+2,2,12,secondary); rect(bx+18,by+3,2,12,'#421d52'); rect(bx+3,by+14,17,2,ink);
      rect(bx+5,by+5,3,2,'#ffffff66');
    }
  } else if(['boss-king','boss-ember-king','boss-frost-king'].includes(key)) {
    grid([
      '...........GGGGGGGGGG...........',
      '.........GGLLLLLLLLLLGG.........',
      '........GLLLLLLLLLLLLLLG........',
      '.......GLLLLLLLLLLLLLLLLG.......',
      '......GLLGGGGGGGGLLLLLLLLG......',
      '.....GLLGWWWWWWWWGGLLLLLLLG.....',
      '....GLLGWWWWWWWWWWGLLLLLLLG.....',
      '....GLGWWKKKKKKKWWWGLLLLLLLG....',
      '...GLLGWKKKKKKKKKWWGLLLLLLLG....',
      '...GLLGWKKWWKKWWKWWGLLLLLLLG....',
      '...GLLGWKKWWKKWWKWWGLLLLLLLG....',
      '...GLLGWKKKWKKKWKWWGLLLLLLLG....',
      '....GLGWKKKKKKKKKWWGLLLLLLG.....',
      '....GLGWWKKKKKKKWWWGLLLLLG......',
      '.....GGWWWWWWWWWWWWGGGGG.......',
      '.....RRRRRRRRRRRWWWWWWGG.......',
      '....ROOOOOOOOOOORWWWWWWG...RR..',
      '...ROOOWWOOOOOOOORWWWWWG..ROOR.',
      '..ROOOWWOOOOOOOOOORWWWWG...RR..',
      '..ROOOOOOOOOOOOOOOORWWGG.......',
      '..ROOOOKKOOOOOKKOOOORGGGG......',
      '...ROOOKKOOOOOKKOOOORLLLG......',
      '....ROOOOOOOOOOOOOORLLLLG......',
      '.....RRRRRRRRROOOORLLLLLG......',
      '....GLLLGKKKKROOOORLLLLLLG.....',
      '....GLLLGKKKKROOORLLLLLLLG.....',
      '....GLLLLGRRRRRRLLLLLLLLLG.....',
      '.....GLLLLLLLLLLLLLLLLLG.......',
      '....RRRGLLLLLLLLLLLLGGRRR......',
      '...ROOORRGGGGGGGGGGGRROOOR.....',
      '..ROOOOOORR.......RROOOOOOR....',
      '..RRRRRRRRR.......RRRRRRRRR....',
    ], key==='boss-ember-king'
      ? {G:'#84252b',L:'#ef563b',W:'#fff0c9',K:'#11131d',R:'#7b233f',O:'#ffbf4c'}
      : key==='boss-frost-king'
        ? {G:'#276388',L:'#69cce9',W:'#f1fdff',K:'#11131d',R:'#5264ac',O:'#c2e8ff'}
        : {G:'#347720',L:'#83c52d',W:'#fff8dd',K:'#11131d',R:'#b63d2c',O:'#f48648'},3);
    if(key==='boss-ember-king') { flame(18,0,2);flame(66,0,2); }
    if(key==='boss-frost-king') grid(['..W...W...W..','..WB.WBW.BW..','..WBBBWBBBW..','...BBBBBBB...','....BBBBB....'],{W:'#f4ffff',B:'#8ddfff'},3,27,0);
  } else if(key==='boss-lightning') {
    for(let y=0;y<h;y+=24) { rect(8,y,6,10,'#ffdf72');rect(10,y+8,10,5,'#ff6844');rect(4,y+12,12,5,'#ff6844');rect(7,y+16,6,8,'#ffb259'); }
  } else if(key==='boss-ice') {
    grid(['.....W.....','....WBW....','...WBBBW...','..WBCBBBW..','.WBCBBBBBW.','..WBBBBBW..','...WBBBW...','....WBW....','.....W.....'],{W:'#eeffff',B:'#56baf5',C:'#c5faff'},2,3,3);
  } else if(key==='boss-fire') {
    flame(4,2,2);
  } else if(key.startsWith('ghost_')) {
    const variant = Number(key.match(/-v(\d+)/)?.[1] ?? 0) % 8;
    const silhouettes = [
      // Wind-up knight: silver helmet, visor, blue feet.
      ['.....WWWWW.....','...WWWWWWWWW...','..WWSSSSSSSWW..','..WSKSKSKSKSW..','..WSKSKSKSKSW..','..WWSSSSSSWWW..','...WWWWWWWW....','....RRRRRR.....','...BBBBBBBB....','..BBBBBBBBBB...','..BB......BB...'],
      // White, orange-beaked drifter.
      ['.......WWW.....','.....WWWWWW....','....WWWWWWW....','...WWKKWWWWW...','..RRRKKWWWWW...','..RRRWWWWWW....','....WWWWWW.....','...WWWWWWWWW...','..WWWWWWWWWW...','...RR...RR.....','..RRR...RRR....'],
      // Purple dome with a long muzzle and short flat feet.
      ['.....BBBB......','...BBBBBBBB....','..BBBBWWBBBB...','.BBBBBWWBBBBB..','.BBBBBBBBBBBB..','.BBBBBBBBBBBB..','..BBKKBBBBBBBB.','..BBBBBBBBBBBB.','...BBBBBBBB....','..BBB....BBB...','.BBBB....BBBB..'],
      // Orange horned crawler.
      ['....W.....W....','....WW...WW....','...BBBBBBBBB...','..BBWWBBBWWBB..','..BBWKBBBWKBB..','..BBBBBBBBBBB..','...BBBBBBBBB...','..BBBRRRRBBB...','.BBB.BBBB.BBB..','...BB....BB....','..BBB....BBB...'],
      // Blue pointed snow-ghost.
      ['......WW.......','.....WWWW......','....WWWWWW.....','...WWWWWWWW....','..WWWBBWWBBWW..','..WWWBBWWBBWW..','..WWWWWWWWWWW..','...WWBBBBWW....','....WWWWWW.....','...BB..BB.BB...','..BBB..BB.BBB..'],
      // Red runner with a green cap and protruding snout.
      ['....GGGGGG.....','...GRRRRRRG....','..GRRWWRRRR....','..RRRWKRRRR....','.RRRRWWRRRR....','.WWWWRRRRRR....','..RRRRRRRR.....','....RRRRRR.....','...RRR.RRR.....','..WWW...WWW....','.WWWW...WWWW...'],
      // Cyan, long-eared spring monster.
      ['..BB....BB.....','...BB..BB......','...BBBBBBBB....','..BBWWWWBBB....','.BBBKKWWBBBB...','.BBBWWWWBBBB...','..BBBBBBBBBB...','....BBBBBBBB...','...BB.BB.BB....','..BB..BB..BB...','.BBB.....BBB...'],
      // Green cloaked magician, peach face and curled hat.
      ['...GGGGGGGG....','..GGGGGGGGGG...','.GGG......GG...','.GG.OOOOO.GG...','.GG.OWKOO.GG...','..G.OOOOO.GG...','...GGGGGGGG....','..GGGOOOGGGG...','...GGGGGGGG....','....RR..RR.....','...RRR..RRR....'],
    ];
    const colors = ['#c2d4e5','#fff5e6','#a57bd9','#c57839','#65beec','#e75b43','#51b8c8','#75ad3a'];
    const trapped = key.endsWith('-trapped');
    c.save();
    if (trapped) c.translate(0, 1);
    grid(silhouettes[variant],{B:colors[variant],W:white,K:ink,S:'#8393a3',R:'#df634a',G:'#659f31',O:'#f4bd86'},2,0,5);
    if (trapped) { rect(8,21,3,2,white); rect(18,21,3,2,white); }
    c.restore();
  } else if(key==='ghost-whale' || key==='ghost-whale-open') {
    // Skel-Monsta silhouette: rounded white skull, red eye and black saw-tooth jaw.
    // Two jaw frames; drawn facing left, rather than the former long blue whale.
    const rows = [
      '........KKKKK.......',
      '......KKWWWWWKK.....',
      '.....KWWWWWWWWWK....',
      '....KWWRRRRWWWWWK...',
      '...KWWRRPPPRWWWWWK..',
      '..KWWRRPPWPPRWWWWK..',
      '..KWWRRPPWPPRWWWWWK.',
      '.KWWWWRRPPPRWWWWWWK.',
      '.KWWWWWRRRRWWWWWWWK.',
      '.KWWWWWWWWWWWWWWWWK.',
      '.KWWWWWWWWWWKWKWWWK.',
      '.KWWKWWWWWKKKKKKWWK.',
      'KWWWKWWWWKKKKKKKKK..',
      'KWWWKKWKKKKKKKKKK...',
      'KWWWWKKKKKKKKKKK....',
      'KWWWWWKWKKWKKWWK....',
      '.KKWWWWWWWWWWWWK....',
      '...KKKWWWKWWWWK.....',
      '......KKK.KKKK......',
    ];
    if(key==='ghost-whale-open') {
      rows[14]='KWWWWKKKKKKKKKKKK...';
      rows[15]='KWWWWWKKKKKKKKKK....';
      rows[16]='.KKWWWWKWKKWKWK.....';
    }
    grid(rows,{K:'#10101a',W:'#ffffff',R:'#cf2148',P:'#ff6578'},2.4,0,1);
  } else if(key.startsWith('bubble')) {
    const color=key.includes('fire')?'#ff7546':key.includes('lightning')?'#83c52d':key.includes('green')?'#79f353':key.includes('blue')?'#61aeff':'#5be8ff';
    orb(color);
    if(key.includes('lightning')) bolt(8,6,1.6);
    if(key.includes('fire')) flame(7,5,1.6);
    if(key.includes('water')) grid(['.....B','....BB','...BBB','..BBBB','.BBBBB','BBBBBB'],{B:'#459bed'},2,7,9);
  } else if(key==='strawberry') {
    grid(['...GG.GG....','....GGG.....','..RRRRRRR...','.RRWRRWRRR..','.RRRRRRRRR..','..RRWRRWR...','...RRRRR....','....RRR.....','.....R......'],{G:'#65ed67',R:'#ff5678',W:'#fff4b4'},2,2,3);
  } else if(key==='apple') {
    grid(['......GG....','.....GG.....','..RRRGRRR...','.RRWWRRRRR..','.RRWRRRRRR..','.RRRRRRRRR..','.RRRRRRRRR..','..RRRRRRR...','...RR.RR....'],{G:'#76b735',R:'#f26a42',W:'#fff2c9'},2,2,4);
  } else if(key==='grapes') {
    grid(['....GGGG....','.....G......','..PPPPPPP...','.PWWPPWWPP..','..PPPPPPP...','...PPPPP....','...PWPPP....','....PPP.....','.....P......'],{G:'#78be41',P:'#b685d5',W:'#f3d5f5'},2,2,4);
  } else if(key==='cherries') {
    grid(['......GG....','.....G.G....','....G...G...','...G.....G..','..RRR...RRR.','.RWRRR.RWRRR','.RRRRR.RRRRR','..RRR...RRR.'],{G:'#9dc879',R:'#ef4f85',W:'#ffe4e9'},2,0,5);
  } else if(key==='banana') {
    grid(['.........GG.','........YY..','........YY..','.......YYY..','......YYYY..','....YYYYY...','..YYYYYY....','.YYYYYY.....','..YYYY......'],{G:'#85dc54',Y:'#ffdf53'},2,1,3);
  } else if(key==='cookie') {
    grid(['...OOOOO....','..OYYYYYO...','.OYYKYYYYO..','.OYYYYKYYO..','.OYKYYYYYO..','.OYYYYKYYO..','..OYYYYYO...','...OOOOO....'],{O:'#bc6b3d',Y:'#ffce75',K:'#74374b'},2,2,5);
  } else if(key.endsWith('-item')) {
    const kind=key.replace('-item','');
    if(kind==='fire' || kind==='lightning') { orb(kind==='fire'?'#f48648':'#83c52d'); if(kind==='fire') flame(7,5,1.6); else bolt(8,6,1.6); }
    else if(kind==='water') grid(['....WWWW.....','.....WW......','.....WW......','....WWWW.....','...WBBBBW....','..WBBWBBBW...','..WBBWBBBW...','..WBBBBBBW...','...WBBBBW....','....WWWW.....'],{B:'#51d8e5',W:white},2,0,4);
    else if(kind==='shoes') grid(['........WW...','.......RRR...','......RRRR...','.....RWWRR...','..RRRRRRRRR..','.RRRRRRRRRRR.','.WWWWWWWWWWW.','..BBBBBBBBB..'],{R:'#ff6a96',W:white,B:'#694499'},2,0,7);
    else if(kind==='shield') grid(['......Y......','..YYYYYYYYY..','..YBBBBBBBY..','..YBBBWBBBY..','..YBBWWWBBY..','...YBBWBBY...','....YBBBY....','.....YBY.....','......Y......'],{Y:'#ffdf53',B:'#48dbaa',W:white},2,0,6);
    else if(kind==='cloud') grid(['.....WWWW....','...WWWWWWWW..','..WWWWWWWWW..','.WWWWWWWWWWW.','.WBBWBBWBBWW.','..BBBBBBBBB..','...B..B..B...','..B..B..B....'],{W:white,B:'#77cfff'},2,0,7);
    else if(kind==='shootingStar') grid(['YY...........', '.YY....Y.....', '..YY..YYY....', '...YYYYYYY...', '....YYYYYYYYY', '.....YYYYYYY.', '......YYYYY..', '.....YYYYYYY.', '.....YY...YY.'],{Y:'#ffe584'},2,0,4);
    else if(kind==='trash') grid([
      '.....KKKK.....','....KSSSSK....','..KKKKKKKKKK..','.KSSSSSSSSSSK.','.KKKKKKKKKKKK.',
      '..KSSSSSSSSK..','..KSHSHSHSSK..','..KSHSHSHSSK..','..KSHSHSHSSK..','..KSHSHSHSSK..','...KSSSSSSK...','...KKKKKKKK...',
    ],{K:'#242336',S:'#94a6b2',H:'#d5e2e7'},2,0,3);
    else if(kind==='rainbow') {
      ['#ff577f','#ff9c43','#ffdf53','#73e579','#51bfff','#b883ff'].forEach((color,i)=>{
        for(let x=1+i;x<13-i;x++) {const y=Math.round(11-Math.sqrt(Math.max(0,(6-i)*(6-i)-(x-7)*(x-7))));rect(x*2,y*2,2,2,color);}
      });rect(0,23,7,5,white);rect(21,23,7,5,white);
    }
    rect(4,29,20,2,'#ffffff55');
  } else if(key.startsWith('letter-')) {
    const glyphs:Record<string,string[]>={E:['111','100','110','100','111'],X:['101','101','010','101','101'],I:['111','010','010','010','111'],T:['111','010','010','010','010']};
    orb(accent,true); grid(glyphs[key.slice(-1)],{'1':white},3,10,8);
  } else if(key==='spark') {
    rect(2,0,2,6,white);rect(0,2,6,2,white);
  }
}
