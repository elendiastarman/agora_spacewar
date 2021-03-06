var SCALE = 1.0;
var gameOver = 0;
var gameInfo = {};

var events = [];

window["red"] = {"color":"red"};
window["blue"] = {"color":"blue"};
var teams = [window["red"], window["blue"]];

var shipShapes = {
	'full ship': [[-8,16],[0,-8],[8,16]],
	'left wing': [[-8,16],[0,-8],[4,4],[0,8],[0,16]],
	'right wing':[[-4,4],[0,-8],[8,16],[0,16],[0,8]],
	'nose only': [[-4,4],[0,-8],[4,4],[0,8]]
};
var engineFlame = {
	'full ship':[[[-4,16],[0,20],[4,16]],[[-4,16],[0,24],[4,16]]],
	'left wing':[[[-4,16],[0,20],[0,16]],[[-4,16],[0,24],[0,16]]],
	'right wing':[[[0,16],[0,20],[4,16]],[[0,16],[0,24],[4,16]]],
}

var field;
var fieldWidth = 800;
var fieldHeight = 600;
gameInfo.fieldWidth = fieldWidth;
gameInfo.fieldHeight = fieldHeight;

window["sun"] = {"cx":fieldWidth/2, "cy":fieldHeight/2, "r":5, "points":[]}
for (var i=0; i<8; i++) {
	var px = sun.cx+sun.r*Math.cos(i*Math.PI/4);
	var py = sun.cy+sun.r*Math.sin(i*Math.PI/4);
	sun.points.push([px,py]);
}

var missileTimeout = 75; //75 frames, 2250 ms;
var missileSpeed = 10;
var fireRateLimit = 4; //3 frames, 120 ms
var missileMax = 20;
var numMissiles = 0;

var gravityStrength = 1*5000;
var speedLimit = 15; //engine propulsion
var maxSpeed = 40; //gravity-boosted
var engineThrust = 0.30;

var overideHyperspace = null; // if you wish to disable hyperspace death, set this to 0.
["gravityStrength","speedLimit","maxSpeed","engineThrust"].forEach(function(attr){
	gameInfo[attr] = window[attr];
});

var hyperDuration = 34; //34 frames, 1020 ms
var deathDuration = 34; //34 frames, 1020 ms

var frameCount;
var restartFrame = false;
var gameDuration = 3000; //3000 frames, 90 seconds

function getRemainingTime() {
	var remainingFrames = gameDuration - frameCount;
	if (remainingFrames > 0) {
		return Math.floor((remainingFrames/(100/3))/60)+":"+(("00"+Math.floor(remainingFrames/(100/3))%60).slice(-2));
	} else {
		return "GAME OVER";
	}
}
var timeLeft = {'name':'time-left', 'x':fieldWidth/2, 'color':'lightgray', 'getText':getRemainingTime};
var redScore = {'name':'red-score', 'x':fieldWidth/2-150, 'color':'red', 'getText':function(){ return red.score; }};
var blueScore = {'name':'blue-score', 'x':fieldWidth/2+150, 'color':'blue', 'getText':function(){ return blue.score; }};
var redStock = {'name':'red-stock', 'x':10, 'y':20, 'color':'red', 'fontsize':'15px', 'align':'start', 'getText':function(){ return "Missiles: "+window['red'].missileStock; }};
var blueStock = {'name':'blue-stock', 'x':fieldWidth-10, 'y':20, 'color':'blue', 'fontsize':'15px', 'align':'end', 'getText':function(){ return "Missiles: "+window['blue'].missileStock; }};
var textInfo = [timeLeft,redScore,blueScore,redStock,blueStock];

var showIntersections = false;

Math.radians = function(degrees) { return degrees * Math.PI / 180; };
Math.degrees = function(radians) { return radians * 180 / Math.PI; };

function initGame() {
	var svg = d3.select('#playfield').append("svg")
		.attr("width",fieldWidth)
		.attr("height",fieldHeight)
		.attr("id","field");
	field = d3.select('#field');
	svg.append("rect")
		.attr("width",fieldWidth)
		.attr("height",fieldHeight)
		.attr("fill","black");
		
	svg.selectAll('.text').data(textInfo)
	  .enter().append("text") //time and scores
		.attr("id",function(d){ return d.name; })
		.attr("x",function(d){ return d.x; })
		.attr("y",function(d){ return d.y || 30; })
		.attr("font-family","sans-serif")
		.attr("font-size",function(d){ return d.fontsize || "30px"; })
		.attr("fill",function(d){ return d.color; })
		.attr("class","text")
		.attr("text-anchor",function(d){ return d.align || "middle";})
		.text(function(d){ return d.getText(); });
	gameInfo.redScore = 0;
	gameInfo.blueScore = 0;
	gameInfo.timeLeft;// = gameDuration;
	
	field.append("circle") //sun
		.attr("cx",sun.cx)
		.attr("cy",sun.cy)
		.attr("r", sun.r*SCALE)
		.style("fill","white")
		.attr("id","sun");
	gameInfo.sun_x = sun.cx;
	gameInfo.sun_y = sun.cy;
	gameInfo.sun_r = sun.r*SCALE;
	
	field.selectAll(".ship").data(teams).enter().append("polygon")
		.attr("id", function(d){return d.color;})
		.attr("fill", function(d){return d.color;})
		.attr("class", "ship");
	
	field.selectAll(".flame").data(teams).enter().append("polygon")
		.attr("id", function(d){return "flame"+d.color;})
		.attr("fill", function(d){return d.flame-1 ? "yellow" : "lightyellow";})
		.attr("class", "flame");
	
	setupGame(1);
	return gameInfo;
}

function setupGame(start) {
	if (start) {
		gameOver = 0;
		
		frameCount = 0;
		teams.forEach(function(ship){
			ship.score = 0;
		});
        
        events = [];
        events.push({'type':'game', 'status':'start', 'frame':frameCount});
	}
	
	restartFrame = false;
    events.push({'type':'round', 'status':'start', 'frame':frameCount});
	
	red.x = 50;
	red.y = Math.floor((fieldHeight-100)*Math.random())+50;
	red.rot = 90;
	red.deadColor = "#FF8888";
	
	blue.x = fieldWidth-50;
	blue.y = Math.floor((fieldHeight-100)*Math.random())+50;
	blue.rot = -90;
	blue.deadColor = "#8888FF";
	
	teams.forEach(function(ship){
		ship.xv = 0.0;
		ship.yv = 0.0;
		ship.fireFrame = -1;
		ship.missileReady = true;
		ship.missileStock = missileMax;
		ship.updateShape = true;
		ship.shape = "full ship";
		ship.thrust = engineThrust;
		ship.flame = 0;
		ship.turnRate = 5;
			
		ship.deathFrame = false;
		ship.hyperFrame = false;
		ship.exploded = false;
		ship.alive = true;
		
		field.select("#"+ship.color).style("fill",ship.color);
		
		["x","y","rot","xv","yv","shape","missileStock","exploded","alive"].forEach(function(attr){
			gameInfo[ship.color+"_"+attr] = ship[attr];
		});
	});
	
	missiles = [];
	field.selectAll('.missile').remove();
	if (showIntersections) {
		teams.forEach(function(ship){
			field.selectAll('.intP'+ship.color).remove();
			field.selectAll('.shipVerts'+ship.color).remove();
			field.selectAll('.missileHit'+ship.color).remove();
		});
	}
    
    field.selectAll('.debris').remove();
    debris = [];
	updateGraphics(0);
}

function updateGame() {
	if (frameCount > gameDuration) {
		timeLeft.text = "GAME OVER";
		gameOver = 1;
        events.push({'type':'game', 'status':'end', 'frame':frameCount});
		updatePositions(1);
		updateGraphics(1);
        checkAchievements();
        sendData();
		return 1;
	} else if (restartFrame && frameCount - restartFrame > 100) {
		setupGame(0);
		restartFrame = false;
        checkAchievements();
		return 0;
	}
	
	if (missiles.length){
		var filteredMissiles = [];
		for (var i=0; i<missiles.length; i++) {
			var m = missiles[i];
			if (frameCount - m.frameNum > missileTimeout){
                m.live = false;
                events.push({'type':'death', 'team':'missile', 'frame':frameCount, 'mid':m.id, 'mteam':m.team, 'why':'time'});
            }
				
			if (m.live) {
				filteredMissiles.push(m);
			}
		}
		missiles = filteredMissiles;
	}
	
	if (redPlayer !== "human" && frameCount - red.fireFrame > fireRateLimit) { red.missileReady = true; }
	if (bluePlayer !== "human" && frameCount - blue.fireFrame > fireRateLimit) { blue.missileReady = true; }
	
	updatePositions(0);
	if (!accelerated) {
		updateGraphics(0);
	}
	
	teams.forEach(function(ship){
		["x","y","rot","xv","yv","shape","missileStock","exploded","alive"].forEach(function(attr){
			gameInfo[ship.color+"_"+attr] = ship[attr];
		});
		gameInfo[ship.color+"_inHyperspace"] = ship.hyperFrame ? true : false;
	});
	
	gameInfo.missiles = [];
	missiles.forEach(function(m){
		gameInfo.missiles.push({"x":m.x,"y":m.y,"xv":m.xv,"yv":m.yv,});
	});
	gameInfo.numMissiles = missiles.length;
	
	gameInfo.redScore = red.score;
	gameInfo.blueScore = blue.score;
	gameInfo.timeLeft = Math.floor((gameDuration - frameCount)/(100/3));
	
    checkAchievements();
    
	frameCount += 1;
	return 0;
}

function updatePositions(debrisOnly) {
	debris.forEach(function(fragment){
		fragment.x += fragment.xv;
		fragment.y += fragment.yv;
		fragment.rot += fragment.rotVel;
	});
	if (debrisOnly) { return; }
	
	var sun = d3.select('#sun');
	
	teams.forEach(function(ship){
		if (ship.alive && !ship.hyperFrame) {
			var dx = ship.x - sun.attr('cx');
			var dy = ship.y - sun.attr('cy');
			var dis = Math.sqrt(dx*dx+dy*dy);
			if (dx*dx+dy*dy > 5){
				var force = gravityStrength / (dx*dx+dy*dy);
			} else {
				var force = gravityStrength/5;
			}
			ship.xv += -force*dx/dis;
			ship.yv += -force*dy/dis;
			
			var speed = ship.xv*ship.xv + ship.yv*ship.yv;
			if (speed > maxSpeed*maxSpeed) {
				ship.xv = maxSpeed*ship.xv/Math.sqrt(speed);
				ship.yv = maxSpeed*ship.yv/Math.sqrt(speed);
			}
		
			checkShipSunCollision(ship);
			
			if (ship.rot > 180) {
				ship.rot -= 360;
			} else if (ship.rot < -180) {
				ship.rot += 360;
			}
		}
	});
	
	checkShipShipCollision(teams[0],teams[1]);
	
	missiles.forEach(function(m){
		var dx = m.x - sun.attr('cx');
		var dy = m.y - sun.attr('cy');
		var dis = Math.sqrt(dx*dx+dy*dy);
		if (dx*dx+dy*dy > 5){
			var force = gravityStrength / (dx*dx+dy*dy);
		} else {
			var force = gravityStrength/5;
		}
		m.xv += -force*dx/dis;
		m.yv += -force*dy/dis;
		
		var speed = m.xv*m.xv + m.yv*m.yv;
		if (speed > maxSpeed*maxSpeed*2) {
			m.xv = 1.414*maxSpeed*m.xv/Math.sqrt(speed);
			m.yv = 1.414*maxSpeed*m.yv/Math.sqrt(speed);
		}
		
		checkMissileCollision(m, "sun");
		checkMissileCollision(m, "red");
		checkMissileCollision(m, "blue");
	});
	
	teams.forEach(function(ship){
		if (!ship.hyperFrame) {
			if (!ship.exploded) {
				ship.x += ship.xv;
				ship.x = (ship.x+fieldWidth)%fieldWidth;
				ship.y += ship.yv;
				ship.y = (ship.y+fieldHeight)%fieldHeight;
			}
			
			if (!ship.alive) {
				if (!ship.deathFrame) {
					field.select('#'+ship.color).style("fill",ship.alive ? ship.color : ship.deadColor);
					ship.deathFrame = frameCount;
					restartFrame = frameCount;
					
					if (ship.color === "red") {
						blue.score += 1;
                        events.push({'type':'score', 'team':'blue', 'frame':frameCount, 'score':blue.score});
					} else if (ship.color === "blue") {
						red.score += 1;
                        events.push({'type':'score', 'team':'red', 'frame':frameCount, 'score':red.score});
					}
				}
				
				ship.xv = 0;
				ship.yv = 0;
			}
		} else if (frameCount - ship.hyperFrame > hyperDuration) {
			ship.x = Math.random()*(fieldWidth-100)+50;
			ship.y = Math.random()*(fieldHeight-100)+50;
			ship.xv = 0;
			ship.yv = 0;
			var deathChance = overideHyperspace==null ? (ship.shape === "full ship" ? 0.25 : 0.5) : overideHyperspace;
			if (Math.random() < deathChance) { ship.alive = false; }
			ship.hyperFrame = false;
		} else {
			ship.x = -200;
			ship.y = -200;
			ship.xv = 0;
			ship.yv = 0;
		}
	});
	
	missiles.forEach(function(m){
		if (m.live) {
			m.x = (m.x+m.xv+fieldWidth)%fieldWidth;
			m.y = (m.y+m.yv+fieldHeight)%fieldHeight;
		}
	});
}

function updateGraphics(debrisOnly) {
	d3.selectAll('.text').data(textInfo)
		.text(function(d){ return d.getText(); });
	
	var filteredDebris = [];
	for (var i=0; i<debris.length; i++) {
		if (frameCount < debris[i].frameNum) { filteredDebris.push(debris[i]); }
	}
	debris = filteredDebris;
	
	if (!accelerated) {
		field.selectAll('.debris').data(debris)
			.attr("transform",function(d){ return "translate("+d.x+","+d.y+"),rotate("+d.rot+")"; })
			.attr("points",function(d){ return d.pointsStr; })
			.style("fill",function(d){ return d.color; });
		field.selectAll('.debris').data(debris).exit().remove();
	}
	
	if (debrisOnly) { return; }
	
	if (!accelerated) {
		var dots = d3.select("#field").selectAll('.missile').data(missiles);
		dots.attr("cx", function(d){ return d.x; })
			.attr("cy", function(d){ return d.y; });
		dots.exit().remove();
	}
	
	field.selectAll(".ship").data(teams)
		.attr("transform",function(ship){return "translate("+ship.x+","+ship.y+"),rotate("+ship.rot+")";});
	
	field.selectAll(".flame").data(teams)
		.attr("transform",function(ship){return "translate("+(ship.flame && ship.alive ? ship.x : -200)+","+(ship.flame && ship.alive ? ship.y : -200)+"),rotate("+ship.rot+")";})
		.attr("points",function(ship){
			if (ship.shape !== "nose only") {
				var pointsStr = "";
				engineFlame[ship.shape][0+(ship.flame>1)].forEach(function(P){ pointsStr += P[0]+","+P[1]+" "; });
				return pointsStr;
			}
		});
	
	teams.forEach(function(ship){
		
		if (ship.updateShape) {
			var pointsStr = "";
			shipShapes[ship.shape].forEach(function(point){
				pointsStr += point[0]*SCALE+","+point[1]*SCALE+" ";
			});
			field.select("#"+ship.color).attr("points",pointsStr);
			
			switch (ship.shape){
				case "left wing":
				case "right wing":
					ship.thrust /= 2.;
					ship.turnRate /= 2.;
					break;
				case "nose only":
					ship.thrust = 0;
					ship.turnRate = 0;
					break;
			}
			ship.updateShape = false;
		}
		
		if (!ship.alive) {
			if (frameCount - ship.deathFrame > deathDuration && ship.exploded === false) {
				switch (ship.shape) {
					case "full ship":
						shipDebris(ship,"kill full");
						break;
					case "left wing":
						shipDebris(ship,"kill left");
						break;
					case "right wing":
						shipDebris(ship,"kill right");
						break;
					case "nose only":
						shipDebris(ship,"kill nose");
						break;
				}

				ship.exploded = true;
				ship.x = -200;
				ship.y = -200;
				d3.select('#'+ship.color).attr("transform","translate(-200,-200)");
			}
		}
	});
}

function teamMove(team,actions) {
	if (gameOver) { return; }
	
	var ship = window[team];
	var engineFired = 0;
	
	actions.forEach(function(action){
		if (ship.alive && !ship.hyperFrame) {
			if (ship.shape === "nose only" && action !== "fire missile") { return; }
			switch (action){
				case "fire engine":
					ship.flame = ship.flame ? 3-ship.flame : 1;
					fireEngine(ship);
					engineFired = 1;
					break;
				case "fire missile":
					if (frameCount - ship.fireFrame > fireRateLimit && ship.missileReady && ship.missileStock) {
						ship.fireFrame = frameCount;
						ship.missileReady = false;
						ship.missileStock -= 1;
						fireMissile(ship);
					}
					break;
				case "turn right":
					ship.rot = ship.rot + ship.turnRate;
                    events.push({'type':'turn', 'team':ship.color, 'frame':frameCount, 'way':'right'});
					break;
				case "turn left":
					ship.rot = ship.rot - ship.turnRate;
                    events.push({'type':'turn', 'team':ship.color, 'frame':frameCount, 'way':'left'});
					break;
				case "hyperspace":
					ship.hyperFrame = frameCount;
                    events.push({'type':'hyper', 'team':ship.color, 'frame':frameCount});
					break;
			}
		}
	});
	
	if (!engineFired) { ship.flame = 0 }
}

function fireEngine(ship) {
	var speed = ship.xv*ship.xv + ship.yv*ship.yv;
    events.push({'type':'thrust', 'team':ship.color, 'frame':frameCount});
	
	var nxv = ship.xv + ship.thrust*Math.cos(Math.radians(ship.rot-90));
	var nyv = ship.yv + ship.thrust*Math.sin(Math.radians(ship.rot-90));
	var speed2 = nxv*nxv + nyv*nyv;
	
	if (speed < speedLimit*speedLimit || speed2 < speed) { //either slow enough or slowing down
		ship.xv = nxv;
		ship.yv = nyv;
		
		if (speed2 > speed && speed2 > speedLimit*speedLimit) {
			ship.xv = speedLimit*ship.xv/Math.sqrt(speed2);
			ship.yv = speedLimit*ship.yv/Math.sqrt(speed2);
		}
	} else {
		ship.xv = Math.sqrt(speed)*nxv/Math.sqrt(speed2);
		ship.yv = Math.sqrt(speed)*nyv/Math.sqrt(speed2);
	}
}

function checkShipSunCollision(ship, checkOnly) {
	checkOnly = typeof a !== 'undefined' ? checkOnly : false; //http://stackoverflow.com/a/894877/1473772
	
	var sPoints = getShipCoords(ship);
	var tPoints;
	var speed = Math.sqrt(ship.xv*ship.xv+ship.yv*ship.yv);
	var num = Math.ceil(speed);
	
	var dx = sun.cx - ship.x;
	var dy = sun.cy - ship.y;
	var dis = Math.sqrt(dx*dx+dy*dy);
	if (dis > 40) { return; } //pointless to check for a collision if they're far apart
	
	var tPoints = sun.points;
	
	for (var i=0; i<=num; i++) {
		var f = i/num;
		
		for (var j=0; j<sPoints.length; j++) {
			var j2 = (j+1)%sPoints.length;
			var sx1 = sPoints[j][0] + f*ship.xv;
			var sy1 = sPoints[j][1] + f*ship.yv;
			var sx2 = sPoints[j2][0] + f*ship.xv;
			var sy2 = sPoints[j2][1] + f*ship.yv;
			var L1 = [[sx1,sy1],[sx2,sy2]];
			
			for (var k=0; k<tPoints.length; k++) {
				var k2 = (k+1)%tPoints.length;
				var tx1 = tPoints[k][0];
				var ty1 = tPoints[k][1];
				var tx2 = tPoints[k2][0];
				var ty2 = tPoints[k2][1];
				var L2 = [[tx1,ty1],[tx2,ty2]];
				
				var intersection = LineIntersection(L1,L2);
				if (intersection.length) {
					if (checkOnly) {return true;}
					
					if (showIntersections) {
						console.log('Checkbox is checked!');
						var shiftedPoints = [];
						sPoints.forEach(function(C){ shiftedPoints.push([C[0]+f*ship.xv,C[1]+f*ship.yv]); });
						
						var intPoint = field.selectAll('.intP'+ship.color).data([intersection[0]]);
						intPoint.enter().append("circle")
							.attr("r",3)
							.style("fill","green")
							.attr("class","intP"+ship.color);
						intPoint.attr("cx",function(d){return d[0]})
							.attr("cy",function(d){return d[1]});
						
						var shipVerts = field.selectAll('.shipVerts'+ship.color).data(shiftedPoints);
						shipVerts.enter().append("circle")
							.attr("r",2)
							.style("fill","yellow")
							.attr("class","shipVerts"+ship.color);
						shipVerts.attr("cx",function(d){return d[0]})
							.attr("cy",function(d){return d[1]});
						shipVerts.exit().remove();
					}
					ship.xv *= f;
					ship.yv *= f;
					ship.alive = false;
                    events.push({'type':'death', 'team':ship.color, 'frame':frameCount, 'why':'sun'});
					return;
				}
			}
		}
	}
	
	if (checkOnly) {return false;}
}

function checkShipShipCollision(ship1, ship2) {
	var sPoints = getShipCoords(ship1);
	var tPoints = getShipCoords(ship2);
	var speed1 = Math.sqrt(ship1.xv*ship1.xv+ship1.yv*ship1.yv);
	var speed2 = Math.sqrt(ship2.xv*ship2.xv+ship2.yv*ship2.yv);
	var num = Math.max(Math.ceil(speed1), Math.ceil(speed2));
	
	var dx = ship1.x - ship2.x;
	var dy = ship1.y - ship2.y;
	var dis = Math.sqrt(dx*dx+dy*dy);
	if (dis > 40) { return; } //pointless to check for a collision if they're far apart
	
	for (var i=0; i<=num; i++) {
		var f = i/num;
		
		var states = [];
		
		for (var j=0; j<sPoints.length; j++) {
			var j2 = (j+1)%sPoints.length;
			var sx1 = sPoints[j][0] + f*ship1.xv;
			var sy1 = sPoints[j][1] + f*ship1.yv;
			var sx2 = sPoints[j2][0] + f*ship1.xv;
			var sy2 = sPoints[j2][1] + f*ship1.yv;
			var L1 = [[sx1,sy1],[sx2,sy2]];
			
			for (var k=0; k<tPoints.length; k++) {
				var k2 = (k+1)%tPoints.length;
				var tx1 = tPoints[k][0] + f*ship2.xv;
				var ty1 = tPoints[k][1] + f*ship2.yv;
				var tx2 = tPoints[k2][0] + f*ship2.xv;
				var ty2 = tPoints[k2][1] + f*ship2.yv;
				var L2 = [[tx1,ty1],[tx2,ty2]];
				
				var intersection = LineIntersection(L1,L2);
				if (intersection.length) {
					var state1 = identifyDamage(ship1, j, intersection[1][0]);
					var state2 = identifyDamage(ship2, k, intersection[1][1]);
					states.push([state1,state2]);
				}
			}
		}
		
		if (states.length) {
			var priority = ["",""];
			for (var s=0; s<states.length; s++) {
				if (priority[0] !== "dead") {
					priority[0] = states[s][0];
				}
				if (priority[1] !== "dead") {
					priority[1] = states[s][1];
				}
			}
			
			if (priority[0] === "dead" && priority[1] !== "dead") {
				priority[0] = "";
			} else if (priority[1] === "dead" && priority[0] !== "dead") {
				priority[1] = "";
			}
			
			var debrisType;
			switch (priority[0]) {
				case "dead":
					ship1.alive = false;
                    events.push({'type':'death', 'team':ship1.color, 'frame':frameCount, 'why':'ship'});
					break;
				case "left wing":
					shipDebris(ship1,"damage right");
					break;
				case "right wing":
					shipDebris(ship1,"damage left");
					break;
				case "nose only":
					debrisType = "damage "+ship1.shape;
					debrisType = debrisType.substr(0,debrisType.length-5);
					shipDebris(ship1,debrisType);
					break;
			}
			switch (priority[1]) {
				case "dead":
					ship2.alive = false;
                    events.push({'type':'death', 'team':ship2.color, 'frame':frameCount, 'why':'ship'});
					break;
				case "left wing":
					shipDebris(ship2,"damage right");
					break;
				case "right wing":
					shipDebris(ship2,"damage left");
					break;
				case "nose only":
					debrisType = "damage "+ship2.shape;
					debrisType = debrisType.substr(0,debrisType.length-5);
					shipDebris(ship2,debrisType);
					break;
			}
			
			if (priority[0] !== "" && priority[0] !== "dead" && priority[0] !== ship1.shape) {
				ship1.shape = priority[0];
				ship1.updateShape = true;
                events.push({'type':'shape', 'team':ship1.color, 'frame':frameCount, 'shape':priority[0]});
			}
			if (priority[1] !== "" && priority[1] !== "dead" && priority[1] !== ship2.shape) {
				ship2.shape = priority[1];
				ship2.updateShape = true;
                events.push({'type':'shape', 'team':ship2.color, 'frame':frameCount, 'shape':priority[1]});
			}
			
			return;
		}
	}
}

function getShipCoords(ship) {
	if (typeof(ship) === "string") { ship = window[ship]; }
	
	var sPoints = shipShapes[ship.shape];
	var tPoints = [];
	
	for (var i=0; i<sPoints.length; i++) {
		var x = (sPoints[i][0]*Math.cos(Math.radians(ship.rot))-sPoints[i][1]*Math.sin(Math.radians(ship.rot))) + ship.x;
		var y = (sPoints[i][0]*Math.sin(Math.radians(ship.rot))+sPoints[i][1]*Math.cos(Math.radians(ship.rot))) + ship.y;
		tPoints.push([x,y]);
	}
	
	return tPoints;
}

var missiles = [];
function fireMissile(ship) {
	var mx,my,mxv,myv;
	mx = ship.x + 10*Math.cos(Math.radians(ship.rot-90)); //adjusted to appear at the tip of the nose
	my = ship.y + 10*Math.sin(Math.radians(ship.rot-90));
	mxv = ship.xv + missileSpeed*Math.cos(Math.radians(ship.rot-90));
	myv = ship.yv + missileSpeed*Math.sin(Math.radians(ship.rot-90));
	
	var dx = sun.x - mx;
	var dy = sun.y - my;
	var dis = Math.sqrt(dx*dx+dy*dy);
	if (dis <= sun.r || checkShipSunCollision(ship,true)) { return; }
	
	missiles.push({'x':mx, 'y':my, 'xv':mxv, 'yv':myv, 'frameNum':frameCount, 'live':true, 'id':numMissiles, 'team':ship.color});
    events.push({'type':'fire', 'team':ship.color, 'frame':frameCount, 'mid':numMissiles, 'mteam':ship.color});
    numMissiles += 1;
	
	if (!accelerated) {
		d3.select("#field").selectAll(".missile")
			.data(missiles)
		  .enter().append("circle")
			.attr("cx", function(d){ return d.x; })
			.attr("cy", function(d){ return d.y; })
			.attr("r", 1.5)
			.style("fill","white")
			.attr("class", "missile");
	}
}

function checkMissileCollision(m, obj) {
	if (obj === "sun") {
		var points = sun.points;
		var L1 = [[m.x,m.y],[m.x+m.xv,m.y+m.yv]];
		var len = points.length;
		
		for (var i=0; i<len; i++) {
			var L2 = [[points[i][0],points[i][1]], [points[(i+1)%len][0],points[(i+1)%len][1]]];
			var intersection = LineIntersection(L1, L2);
			
			if (intersection.length) {
                if(m.live){ events.push({'type':'death', 'team':'missile', 'frame':frameCount, 'mid':m.id, 'mteam':m.team, 'why':'sun'}); }
                m.live = false;
            }
		}
	} else if (obj === "red" || obj === "blue") {
		var ship = window[obj];
		
		var sPoints = getShipCoords(ship);
		var len = sPoints.length;
		var num = Math.ceil(1+Math.sqrt(ship.xv*ship.xv+ship.yv*ship.yv));
		
		for (var i=0; i<num; i++) {
			var f = i/num;
			var mx1 = m.x + f*m.xv;
			var my1 = m.y + f*m.yv;
			var mx2 = m.x + (i+1)/num*m.xv;
			var my2 = m.y + (i+1)/num*m.yv;
			var L1 = [[mx1,my1],[mx2,my2]];
			
			var closestIntersection = [];
			
			for (var j=0; j<len; j++) {
				var j2 = (j+1)%len;
				var sx1 = sPoints[j][0] + f*ship.xv;
				var sy1 = sPoints[j][1] + f*ship.yv;
				var sx2 = sPoints[j2][0] + f*ship.xv;
				var sy2 = sPoints[j2][1] + f*ship.yv;
				var L2 = [[sx1,sy1],[sx2,sy2]];
				var intersection = LineIntersection(L1, L2);
				
				if (intersection.length) {
					if (!closestIntersection.length || (intersection[1][0] < closestIntersection[1][0])) {
						closestIntersection = intersection;
						closestIntersection.push(j);
					}
				}
			}
			
			if (closestIntersection.length) {
				m.live = false;
                events.push({'type':'death', 'team':'missile', 'frame':frameCount, 'mid':m.id, 'mteam':m.team, 'why':'ship'});
				if (!ship.alive){return;}
				
				if (showIntersections) {
					field.append("circle")
						.attr("cx",closestIntersection[0][0])
						.attr("cy",closestIntersection[0][1])
						.attr("r",2)
						.style("fill","cyan")
						.attr("class",'missileHit'+ship.color);
				}
				
				var state = identifyDamage(ship, closestIntersection[2], closestIntersection[1][1]);
				if (state) {
					var debrisType;
					switch (state) {
						case "dead":
							ship.alive = false;
                            events.push({'type':'death', 'team':ship.color, 'frame':frameCount, 'mid':m.id, 'mteam':m.team, 'why':'missile'});
							break;
						case "left wing":
							shipDebris(ship,"damage right");
							break;
						case "right wing":
							shipDebris(ship,"damage left");
							break;
						case "nose only":
							debrisType = "damage "+ship.shape;
							debrisType = debrisType.substr(0,debrisType.length-5);
							shipDebris(ship,debrisType);
							break;
					}
					
					if (state !== "dead") {
						ship.shape = state;
						ship.updateShape = true;
                        events.push({'type':'shape', 'team':ship.color, 'frame':frameCount, 'shape':ship.shape});
					}
				}
				
				if (!ship.alive){
					ship.xv *= f;
					ship.yv *= f;
				}
				
				return;
			}
		}
	}
}

function identifyDamage(ship,which,where) {
	var state;
	
	if (ship.shape === "full ship") {
		switch(which) {
			case 0:
				if (where > 0.5) { //hit on the nose
					state = "dead"
				} else {
					state = "right wing";
				}
				break;
			case 1:
				if (where < 0.5) { //hit on the nose
					state = "dead"
				} else {
					state = "left wing";
				}
				break;
			case 2:
				if (where < 0.5) { //hit on the right side
					state = "left wing";
				} else {
					state = "right wing";
				}
				break;
		}
	} else if (ship.shape === "left wing") {
		switch(which) {
			case 0:
				if (where > 0.5) { //hit on the nose
					state = "dead"
				} else {
					state = "nose only";
				}
				break;
			case 1:
			case 2:
				state = "dead"
				break;
			case 3:
			case 4:
				state = "nose only";
				break;
		}
	} else if (ship.shape === "right wing") {
		switch(which) {
			case 1:
				if (where < 0.5) { //hit on the nose
					state = "dead"
				} else {
					state = "nose only";
				}
				break;
			case 0:
			case 4:
				state = "dead"
				break;
			case 2:
			case 3:
				state = "nose only";
				break;
		}
	} else if (ship.shape === "nose only") {
		state = "dead"
	}
	
	return state;
}

function LineIntersection(L1, L2) {
	// from http://stackoverflow.com/a/565282/1473772
	var p = L1[0];
	var r = [L1[1][0]-L1[0][0], L1[1][1]-L1[0][1]];
	var q = L2[0];
	var s = [L2[1][0]-L2[0][0], L2[1][1]-L2[0][1]];
	
	var rcs = r[0]*s[1] - s[0]*r[1]; //r cross s
	var qmp = [q[0]-p[0],q[1]-p[1]]; //q minus p
	var qmpcr = qmp[0]*r[1] - r[0]*qmp[1]; //(q minus p) cross r
	var qmpcs = qmp[0]*s[1] - s[0]*qmp[1]; //(q minus p) cross s
	
	if (rcs === 0) { //they're parallel/colinear
		return []; //I'm just going to assume that overlapping colinear lines don't happen
	} else { //not parallel
		var t = qmpcs/rcs;
		var u = qmpcr/rcs;
		
		if (0 <= t && t <= 1 && 0 <= u && u <= 1) { //intersection exists
			var intx = p[0] + t*r[0];
			var inty = p[1] + t*r[1];
			return [[intx,inty],[t,u]];
		} else { //no intersection
			return [];
		}
	}
}

var debris = [];
function shipDebris(ship,kind) {
	var cx,cy,num;
	switch(kind) {
		case "kill full":
			num = 11;
			cx = ship.x;
			cy = ship.y;
			break;
		case "kill left":
			num = 7;
			cx = ship.x + 3*Math.cos(Math.radians(ship.rot+180));
			cy = ship.y + 3*Math.sin(Math.radians(ship.rot+180));
			break;
		case "kill right":
			num = 7;
			cx = ship.x + 3*Math.cos(Math.radians(ship.rot));
			cy = ship.y + 3*Math.sin(Math.radians(ship.rot));
			break;
		case "kill nose":
			num = 3;
			cx = ship.x + 2*Math.cos(Math.radians(ship.rot-90));
			cy = ship.y + 2*Math.sin(Math.radians(ship.rot-90));
			break;
		case "damage left":
			num = 4;
			cx = ship.x + 10*Math.cos(Math.radians(ship.rot+120));
			cy = ship.y + 10*Math.sin(Math.radians(ship.rot+120));
			break;
		case "damage right":
			num = 4;
			cx = ship.x + 10*Math.cos(Math.radians(ship.rot+60));
			cy = ship.y + 10*Math.sin(Math.radians(ship.rot+60));
			break;
	}
	// field.append("circle")
		// .attr("cx",cx)
		// .attr("cy",cy)
		// .attr("r",2)
		// .style("fill","magenta")
	
	for (var i=0; i<num; i++) {
		var pointsStr = "";
		for (var j=0; j<3; j++) {
			var rad = Math.random()*5+3;
			var ang = Math.random()*10-5 + j*120;
			var x = rad*Math.cos(Math.radians(ang));
			var y = rad*Math.sin(Math.radians(ang));
			pointsStr += x+","+y+" ";
		}
		var rotVel = Math.random()*2-1;
		var rot = Math.random()*360;
		var frameNum = frameCount + 34 + Math.floor(Math.random()*17);
		var xv = Math.random()*2-1;
		var yv = Math.random()*2-1;
		
		var fragment = {'x':cx, 'y':cy, 'xv':xv, 'yv':yv,
						'rot':rot, 'rotVel':rotVel,
						'pointsStr':pointsStr, 'color':ship.deadColor, 'frameNum':frameNum}
		debris.push(fragment);
	}
	
	if (!accelerated) {
		field.selectAll('.debris').data(debris)
		  .enter().append("polygon")
			.attr("points",function(d){ return d.pointsStr; })
			.attr("transform",function(d){ return "translate("+d.x+","+d.y+"),rotate("+d.rot+")"; })
			.attr("class","debris")
			.style("fill",function(d){ return d.color });
	}
}

function checkAchievements() {
    for(var k=events.length-1; k>=0; k--){
        if(frameCount != events[k]["frame"]){
            events.filter(function(x){return x["frame"] == frameCount && x["type"] == "achievement"}).forEach(function(x){console.log(x["team"]+" earned the achievement "+x["name"]+"!")});
            return;
        }
        
        var ach = [["Weather the Storm", 1, "", 0],
                   ["Long Shot", 1],
                   ["One Shot, One Kill", 1],
                   ["Survivor", 1],
                   ["Patient", 1],
                   ["Last Chance", 1],
                   ["Dominator", 1, [0,0]],
                   ["Executor", 1, [0,0]],
                   ["Head On", 1],
                   ["Kill from the Grave", 1],
                   ["Pacifist", 1, [0,0,0,0]],
        ];
        
        for(var j=k; j>=0; j--){
            var e = events[j];
            
            for(var i=0; i<ach.length; i++){
                
                switch(ach[i][0]){
                    case "Weather the Storm": //Outlast all of your opponent’s missiles
                        if(ach[i][1] == 1){
                            if(e["type"] === "death" && e["team"] === "missile"){
                                ach[i][1] = 2;
                                ach[i][2] = e["mteam"];
                                ach[i][3] = 1;
                                // console.log("WtS try: "+(ach[i][2]==="red"?"blue":"red"));
                            } else {
                                ach.splice(i,1);
                                i -= 1;
                            }
                        } else if (ach[i][1] == 2){
                            if(e["type"] === "death" && e["team"] === "missile" && e["mteam"] === ach[i][2]){
                                ach[i][3] += 1;
                                // console.log("Missiles weathered: "+ach[i][3]);
                                
                                if(ach[i][3] >= missileMax){ //success
                                    console.log("Storm weathered! "+frameCount+" "+ach[i][3]);
                                    events.push({"type":"achievement", "team":(ach[i][2]==="red"?"blue":"red"), "frame":frameCount, "name":"Weather the Storm"});
                                    ach.splice(i,1);
                                    i -= 1;
                                }
                            } else if(e["type"] === "death" && e["team"] !== "missile" && e["team"] !== ach[i][2]){
                                ach.splice(i,1);
                                i -= 1;
                            } else if(e["type"] === "round"){
                                // console.log("Weather the Storm attempt: "+(ach[i][2]==="red"?"blue":"red")+" outlasted "+ach[i][3]+" missiles.");
                                ach.splice(i,1);
                                i -= 1;
                            }
                        }
                        
                        break;
                    case "Long Shot": //Make a kill with a missile close to the end of its life span
                        ach.splice(i,1);
                        i -= 1;
                        break;
                    case "One Shot, One Kill": //Fire only one missile and make a kill with it
                        ach.splice(i,1);
                        i -= 1;
                        break;
                    case "Survivor": //Win a round by your opponent running into the sun
                        ach.splice(i,1);
                        i -= 1;
                        break;
                    case "Patient": //Fire missiles no quicker than every five seconds, on average, during a round
                        ach.splice(i,1);
                        i -= 1;
                        break;
                    case "Last Chance": //Score a kill with your last missile
                        ach.splice(i,1);
                        i -= 1;
                        break;
                    case "Dominator": //Finish the game with five more points than your opponent
                        if(ach[i][1] == 1){
                            if(e["type"] !== "game" || e["status"] !== "end"){
                                ach.splice(i,1);
                                i -= 1;
                            } else {
                                ach[i][1] = 2;
                            }
                        } else if (ach[i][1] == 2){
                            if(e["type"] === "score"){
                                if(e["team"] === "red" && ach[i][2][0] == 0){
                                    ach[i][2][0] = e["score"];
                                } else if(e["team"] === "blue" && ach[i][2][1] == 0){
                                    ach[i][2][1] = e["score"];
                                }
                                
                                if(ach[i][2][0] != 0 && ach[i][2][1] != 0){
                                    if(ach[i][2][0] >= ach[i][2][1]+5){
                                        events.push({"type":"achievement", "team":"red", "frame":frameCount, "name":"Dominator"});
                                    } else if(ach[i][2][0]+5 <= ach[i][2][1]){
                                        events.push({"type":"achievement", "team":"blue", "frame":frameCount, "name":"Dominator"});
                                    }
                                    ach.splice(i,1);
                                    i -= 1;
                                }
                            } else if (e["type"] === "game" && e["status"] === "start"){
                                if(ach[i][2][0] >= ach[i][2][1]+5){
                                    events.push({"type":"achievement", "team":"red", "frame":frameCount, "name":"Dominator"});
                                } else if(ach[i][2][0]+5 <= ach[i][2][1]){
                                    events.push({"type":"achievement", "team":"blue", "frame":frameCount, "name":"Dominator"});
                                }
                                ach.splice(i,1);
                                i -= 1;
                            }
                        }
                        break;
                    case "Executor": //Finish the game with at least five points while your opponent has none
                        if(ach[i][1] == 1){
                            if(e["type"] === "game" || e["status"] === "end"){
                                ach[i][1] = 2;
                            } else {
                                ach.splice(i,1);
                                i -= 1;
                            }
                        } else if (ach[i][1] == 2){
                            if(e["type"] === "score"){
                                if(e["team"] === "red" && ach[i][2][0] == 0){
                                    ach[i][2][0] = e["score"];
                                } else if(e["team"] === "blue" && ach[i][2][1] == 0){
                                    ach[i][2][1] = e["score"];
                                }
                                
                                if(ach[i][2][0] != 0 && ach[i][2][1] != 0){
                                    ach.splice(i,1);
                                    i -= 1;
                                }
                            } else if (e["type"] === "game" && e["status"] === "start"){
                                if(ach[i][2][0] >= 5 && ach[i][2][1] == 0){
                                    events.push({"type":"achievement", "team":"red", "frame":frameCount, "name":"Executor"});
                                } else if(ach[i][2][0] == 0 && ach[i][2][1] >= 5){
                                    events.push({"type":"achievement", "team":"blue", "frame":frameCount, "name":"Executor"});
                                }
                                ach.splice(i,1);
                                i -= 1;
                            }
                        }
                        break;
                    case "Head On": //Score a point by colliding with your opponent after all of your missiles are gone
                        ach.splice(i,1);
                        i -= 1;
                        break;
                    case "Kill from the Grave": //Score a kill with a missile after dying
                        ach.splice(i,1);
                        i -= 1;
                        break;
                    case "Pacifist": //Win the game without firing a single missile
                        ach.splice(i,1);
                        i -= 1;
                        break;
                }
            }
            
            if(ach.length == 0){ break; }
        }

    }
    
}

function sendData() {
    var meta = {"red":redPlayer, "blue":bluePlayer, "gameEnd":events[events.length-1]['frame']};
    var stats = jQuery.extend(true, {}, {
        "game":jQuery.extend(true, {}, {"p1wins":0, "p2wins":0, "ties":0, "p1score":0, "p2score":0, "p1missiles":0, "p2missiles":0}),
        "rounds":[],
    });
    
    // var stats = {};
    // stats["game"] = {};
    // stats["game"]["p1wins"] = 0;
    // stats["game"]["p2wins"] = 0;
    // stats["game"]["ties"] = 0;
    // stats["game"]["p1score"] = 0;
    // stats["game"]["p2score"] = 0;
    // stats["game"]["p1missiles"] = 0;
    // stats["game"]["p2missiles"] = 0;
    // stats["rounds"] = [];
    
    // var roundFrames = events.filter(function(x){return x['type']=='round' && x['status']=='start'})
    // roundFrames.push(events[events.length-1]['frame']); //push the game-end frame
    // for(var i=0; i<roundFrames.length-1; i++){
        // meta["rounds"].push([roundFrames[i], roundFrames[i+1]]);
    // }
    
    var roundStart = 0;
    var roundStatsInit = {"p1win":false, "p2win":false, "tie":false, "p1scored":0, "p2scored":0, "p1missiles":0, "p2missiles":0};
    var roundStats = jQuery.extend(true, {}, roundStatsInit);
    
    for(var i=0; i<events.length; i++){
        var e = events[i];
        
        switch(e['type']){
            case "round":
                if(e['frame'] != roundStart){
                    if(roundStats["p1scored"] > roundStats["p2scored"]){
                        roundStats["p1win"] = true;
                        stats["game"]["p1wins"] += 1;
                    } else if(roundStats["p1scored"] < roundStats["p2scored"]){
                        roundStats["p2win"] = true;
                        stats["game"]["p2wins"] += 1;
                    } else {
                        roundStats["tie"] = true;
                        stats["game"]["ties"] += 1;
                    }
                    roundStats["frameStart"] = roundStart;
                    roundStats["frameEnd"] = e['frame']-1;
                    
                    stats["rounds"].push(roundStats);
                    roundStats = jQuery.extend(true, {}, roundStatsInit);
                    roundStart = e['frame'];
                }
                break;
            case "thrust":
                break;
            case "turn":
                break;
            case "hyper":
                break;
            case "fire":
                if(e['team'] === "red"){
                    roundStats["p1missiles"] += 1;
                    stats["game"]["p1missiles"] += 1;
                } else if(e['team'] === "blue"){
                    roundStats["p2missiles"] += 1;
                    stats["game"]["p2missiles"] += 1;
                }
                break;
            case "death":
                if(e['team'] === "red"){
                    roundStats["p2scored"] = 1;
                } else if(e['team'] === "blue"){
                    roundStats["p1scored"] = 1;
                }
                break;
            case "shape":
                break;
            case "score":
                if(e['team'] === "red"){
                    stats["game"]["p1score"] = e['score'];
                } else if(e['team'] === "blue"){
                    stats["game"]["p2score"] = e['score'];
                }
                break;
        }
    }
    
    jQuery.ajax({
		url: '/api/data',
		type: 'post',
		data: {'events':JSON.stringify(events),
               'meta':JSON.stringify(meta),
               'stats':JSON.stringify(stats),
               //'achievements':JSON.stringify(achievements),
			   },
		dataType: 'html',
		success: function(response) {
			console.log(response);
            run_code("round-stats");
		},
		failure: function(response) {
			console.log(response);
		}
	});
}