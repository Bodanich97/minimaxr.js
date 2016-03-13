import 'babel-polyfill';

const MIN_SEARCH_DEPTH = 5;
const MAX_SEARCH_DEPTH = 9;
const USE_QUIESCENCE_SEARCH = true;
const USE_ALPHA_BETA_PRUNING = true;
const USE_ANALYSIS_CACHE = true;
const ANALYSIS_CACHE_SIZE = 4000;
const MIN_ANALYSIS_CACHE_DEPTH = 3;
const MIN_POSITION_VALUE = -999;
const MAX_POSITION_VALUE = 999;
const QUIESCENCE_EXTENSION_DEPTH = 2;

const NORTH_EAST = 0;
const SOUTH_EAST = 1;
const SOUTH_WEST = 2;
const NORTH_WEST = 3;

function MxAnalysisCache()
{
    this.Entries = [];	
    this.Cursor = 0;

	this.Get = function(player, depth, position)
	{
	    for (let entry of this.Entries)
		{
			if (entry.Player !== player) continue;
			if (entry.Depth < depth) continue;
			if (!entry.Position.Equals(position)) continue;
			return entry.Analysis;
		}
		return null;
	}	
	this.Set = function(player, depth, position, analysis) {
	    if (this.Cursor >= ANALYSIS_CACHE_SIZE) 
	        this.Cursor=0;
	    this.Entries[this.Cursor] = {
	        Depth: depth,
	        Position: position.Clone(),
	        Analysis: analysis
	    };
		this.Cursor++;
	}	
}
var analysisCache = new MxAnalysisCache();

function MxPositionAnalysis(dynamicValue, staticValue, potentialValue, bestMove)
{
	this.DynamicValue = dynamicValue;
	this.StaticValue = staticValue;
	this.PotentialValue = potentialValue;
	this.BestMove = bestMove;
}
function MxPosition()
{
	//create the initial board
	this.Nodes = [];	
	for (let sq=0; sq<=40; sq = NextSquare(sq))
	{
		this.Nodes[sq] = 1; //white pawn
	}
	for (let sq=40; sq<60; sq = NextSquare(sq))
	{
		this.Nodes[sq] = 0; //no mans land
	}
	for (let sq=60; sq<100; sq = NextSquare(sq))
	{
		this.Nodes[sq] = -1; //black pawns
	}	
	
	this.LegalMovesX = function(player, square, direction, captureMode) {
        try {
            var legalMoves = new Array();
            for (var sq = 0; sq < 100; sq = NextSquare(sq)) {
                var man = this.Nodes[sq];
                if (!(player * man > 0 && (square === sq || square == null))) continue;
                for (var dir = 0; dir < 4; dir++) {
                    if (!((IsLegalDirection(player, dir) || IsKing(man) || captureMode) && (direction === dir || direction == null))) continue;
                    if (captureMode) {
                        var moveSegment = new Array();
                        var capture = this.GetCapture(sq, dir);
                        var perpendicularContinuationsFound = false;
                        var lastLandingSquare = null;
                        if (capture == null) continue;
                        do {
                            perpendicularContinuationsFound = false;
                            moveSegment = moveSegment.concat(capture);
                            this.ExecuteMove(capture);
                            lastLandingSquare = moveSegment[moveSegment.length - 3];
                            do {
                                var legalContinuations = this.LegalMovesX(player, TerminalSquare(moveSegment), PreviousDirection(dir), true);
                                legalContinuations = legalContinuations.concat(this.LegalMovesX(player, TerminalSquare(moveSegment), NextDirection(dir), true));
                                for (let continuation of legalContinuations) {
                                    legalMoves[legalMoves.length] = NormalizeMove(moveSegment.concat(continuation));
                                    perpendicularContinuationsFound = true;
                                }
                            } while (this.AdvanceTerminalSquare(moveSegment, dir)); //attempts to advance terminal square forward by 1 and re-execute
                            capture = this.GetCapture(TerminalSquare(moveSegment), dir);
                        } while (capture != null);
                        if (!perpendicularContinuationsFound) {
                            legalMoves[legalMoves.length] = NormalizeMove(moveSegment);
                            while (TerminalSquare(moveSegment) !== lastLandingSquare) {
                                var bb = this.AdvanceTerminalSquare(moveSegment, OppositeDirection(dir));
                                legalMoves[legalMoves.length] = NormalizeMove(moveSegment);
                            }
                        }
                        this.UndoMove(NormalizeMove(moveSegment));
                    } else //non capture mode
                    {
                        var nextSquare = NextSquare(sq, dir, 1);
                        while (this.IsFreeSquare(nextSquare)) {
                            legalMoves[legalMoves.length] = NormalizeMove(new Array(sq, man, 0, nextSquare, 0, man));
                            if (!IsKing(man)) break;
                            nextSquare = NextSquare(nextSquare, dir, 1);
                        }
                    }
                }
            }
            return legalMoves;
        } catch (err) {
            alert('LegalMovesX Error: ' + err);
        }
    }
    this.LegalMoves = function(player)
	{
		try
		{
			var legalMoves = this.LegalMovesX(player, null, null, true);
			if (legalMoves.length === 0) 
			    legalMoves = this.LegalMovesX(player, null, null, false);
			return legalMoves;	
		}
		catch (err)	{alert('Legal Moves generation error: '+err); }
	}
    this.Clone = function() {
        var p = new MxPosition;
        for (let s = 0; s < 100; s = NextSquare(s)) {
            p.Nodes[s] = this.Nodes[s];
        }
        return p;
    }
	this.Equals = function(pos)
	{
		for (let s=0; s<100; s=NextSquare(s)) { if (pos.Nodes[s] !== this.Nodes[s]) return false;}
		return true;
	}
	this.Analysis = function(player, depth, parentBestValue, parentDepth, untilQuiescent)
    { 	
    	try
    	{
    		var legalMoves = this.LegalMoves(player);
    		if (legalMoves.length === 0) 
    		    return new MxPositionAnalysis(MIN_POSITION_VALUE, MIN_POSITION_VALUE, MIN_POSITION_VALUE, null);
    		if (depth >= MIN_ANALYSIS_CACHE_DEPTH && USE_ANALYSIS_CACHE)
    		{
    			var cachedAnalysis = analysisCache.Get(player, depth, this);
    			if (cachedAnalysis != null) 
    			    return cachedAnalysis;
    		}
    		if (depth === 0)
    		{
				if (!(untilQuiescent && parentDepth < MAX_SEARCH_DEPTH && CaptureCount(legalMoves[0]) > 0)) 
	    			return new MxPositionAnalysis(this.StaticValue(player), this.StaticValue(player), MIN_POSITION_VALUE, legalMoves[0]);
	    		else
	    			depth = QUIESCENCE_EXTENSION_DEPTH;			
    		}    	
    		var bestValue = MAX_POSITION_VALUE;
    		var bestPotentialValue = MAX_POSITION_VALUE;
    		var bestChildMove = null;
    		var myPotentialValue = 0;
    		
    		var hit = false;
    		for (let mv of legalMoves)
    		{
    		    this.ExecuteMove(mv);
    			var analysis = this.Analysis(-player, depth-1, bestValue, parentDepth+1, untilQuiescent);
    			this.UndoMove(mv);
    			myPotentialValue += analysis.PotentialValue;

    			if (analysis.DynamicValue < bestValue || (analysis.DynamicValue === bestValue && analysis.PotentialValue < bestPotentialValue)) 
    			{
    				bestValue = analysis.DynamicValue;
    				bestPotentialValue = analysis.PotentialValue;
    				bestChildMove = mv;
    				hit = true;
    			}
    			if ((-bestValue >= parentBestValue) && USE_ALPHA_BETA_PRUNING) 
    			    break;    
    		}
    		if (hit === false) 
    		    console.log('not hit');

    		var myAnalysis = new MxPositionAnalysis(-bestValue, this.StaticValue(player), -myPotentialValue, bestChildMove);
    		if (USE_ANALYSIS_CACHE) 
    		    analysisCache.Set(player, depth, this, myAnalysis);
    		return myAnalysis;
    	}
    	catch (err) {alert ('Error performing analysis: '+err); }
	}

    this.ValueProfile = function(player)
	{
		var valueProfile = new Array();
		for (var d=0; d<MIN_SEARCH_DEPTH; d++)
		{
			valueProfile[d] = this.DynamicValue(player, d, MAX_POSITION_VALUE, 0, false);			
		}
		valueProfile[MIN_SEARCH_DEPTH] = this.DynamicValue(player, d, MAX_POSITION_VALUE, 0, USE_QUIESCENCE_SEARCH);			
		return valueProfile;
    }

	this.IsValidSquare = function(sq)
	{
		try
		{
			var ssq = sq.toString();
			if (ssq.length === 1) ssq = '0'+ssq;
			if (ssq.length !== 2) return false;
			var row = parseInt(ssq.charAt(0));
			var col = parseInt(ssq.charAt(1));
			return ((row%2 === 0 && col%2 === 0) || (row%2 === 1 && col%2 === 1));
		}
		catch (err) {alert('IsValidSquare error: '+err); }
	}
	this.IsFreeSquare = function(sq)
	{
		return (this.IsValidSquare(sq) && this.Nodes[sq] === 0);
	}
	this.ManCount = function(player)
	{
		var c=0;
	    for (var sq=0; sq<100; sq=NextSquare(sq))
	    {
	    	if (AreComrades(this.Nodes[sq], player) || player==null) c++;
	    }
	    return c;
	}
	this.StaticValue = function(player)
    {
    	return this.ManCount(player) - this.ManCount(-player); 
    }
    this.GetCapture = function(square, direction)
	{
		try
		{
		    let mycapture = null;
		    var man = this.Nodes[square];
		    let nextSquare = NextSquare(square, direction, 1);
		    if (IsKing(man))
			{
			    while (this.IsFreeSquare(nextSquare)) {
			        nextSquare = NextSquare(nextSquare, direction, 1);
			    }
			}
			var landingSq = NextSquare(nextSquare, direction, 1);			
			if ((this.Nodes[nextSquare] * man < 0) && this.IsFreeSquare(landingSq))
			{
				mycapture = new Array(square, man, 0, nextSquare, this.Nodes[nextSquare], 0, landingSq, 0, man );
			}
			return mycapture;
		}
		catch (err) {alert('GetCapture error'+err); }
	}
	this.ExecuteMove = function(move)
	{
		try
		{
			for (var x=0; x < move.length; x+=3) {this.Nodes[move[x]] = move[x+2];}			
		}
		catch (err){ alert('ExecuteMove Error: '+ err); }
	};
	this.UndoMove = function(move)
	{
		try
		{
			for (var x=0; x < move.length; x+=3) {this.Nodes[move[x]] = move[x+1];}
		}
		catch (err){ alert('UndoMove Error: '+ err); }
	}
	this.AdvanceTerminalSquare = function(move, dir)
	{
		try
		{
			var finalMan = move[move.length-1];
			if (this.Nodes[move[move.length-3]] !== finalMan) 
			    alert('AdvanceTerminalSquare problem');

			if (!IsKing(finalMan)) return false;
			if (this.IsFreeSquare(NextSquare(TerminalSquare(move),dir,1)))
			{
				this.Nodes[NextSquare(TerminalSquare(move),dir,1)] = finalMan;
				this.Nodes[TerminalSquare(move)] = 0;
				move[move.length-3] = NextSquare(TerminalSquare(move),dir,1);
				return true;				
			}
			else
				return false;
		}
		catch (err) {alert('AdvanceTerminalSquare error'+err); }
	}
}
function MxGame() {
    this.MoveHistory = [];
	this.Position = new MxPosition();
	this.Turn = -1;

	this.BestMove = function()
	{
		return this.Position.Analysis(this.Turn, MIN_SEARCH_DEPTH, MAX_POSITION_VALUE, 0, USE_QUIESCENCE_SEARCH).BestMove;
	}

	this.TryAcceptMove = function(startSquare, endSquare)
	{
		for (let mv of this.Position.LegalMoves(this.Turn))
		{
		    if (mv[0] === startSquare && mv[mv.length - 3] === endSquare) {
		        this.Position.ExecuteMove(mv);
		        this.MoveHistory.push(mv);
		        return true;
		    }
		}
		return false;				
	}
}

function NormalizeMove(move) 
{
	try
	{
		var rootMan = move[1];	
		var mv = new Array(move[0],move[1],move[2]);
		for (let x=3; x < move.length-3; x+=3)
		{
			if (!AreComrades(rootMan, move[x+1]) && !AreComrades(rootMan, move[x+2]))
			{
				mv[mv.length] = move[x];
				mv[mv.length] = move[x+1];
				mv[mv.length] = move[x+2];
			}
		}
		mv[mv.length] = move[move.length-3];
		mv[mv.length] = move[move.length-2];
		mv[mv.length] = move[move.length-1];
		
	    //crown if neccesary
		if (!IsKing(mv[mv.length-1]) && ((rootMan === 1 && mv[mv.length-3]>=91) || (rootMan === -1 && mv[mv.length-3]<=8)))	
		{
			mv[mv.length-1] = mv[mv.length-1]*10;
		}
	    return mv;
	}
	catch (err) { alert('Move normalization error: '+err); }
}
function TerminalSquare(move)
{
	return move[move.length-3];
}
function NextSquare(sq, dir, steps)
{
	try
	{
	    if (sq==null) sq=0;
	    if (steps==null) steps=1;
		switch (dir)
		{
			case NORTH_EAST: return sq+9*steps;
			case SOUTH_EAST: return sq-11*steps;
			case SOUTH_WEST: return sq-9*steps;
			case NORTH_WEST: return sq+11*steps;
			default: 
			{
				switch (sq.toString().charAt(sq.toString().length-1))
				{
					case '8':	return sq+3;
					case '9': return sq+1;
					default: return sq+2;
				}			
			}
		}
	}
	catch (err) {alert('NextSquare error:'+err); }
}

function CaptureCount(move){ return (move.length/3) - 2; }
function IsKing(man){return (man*man > 1);}
function AreComrades(man1, man2) { return (man1*man2 > 0); }
function OppositeDirection(direction) { return (direction + 2) % 4; }
function NextDirection(direction) { return (direction+1)%4; }
function PreviousDirection(direction) { return OppositeDirection(NextDirection(direction)); }
function IsLegalDirection(player, dir){	return ((player === 1)?(dir === NORTH_EAST || dir === NORTH_WEST): (dir === SOUTH_EAST || dir === SOUTH_WEST)); }


export {
    MIN_SEARCH_DEPTH,
    MAX_SEARCH_DEPTH,
    USE_QUIESCENCE_SEARCH,
    USE_ALPHA_BETA_PRUNING,
    USE_ANALYSIS_CACHE,
    ANALYSIS_CACHE_SIZE,
    MIN_ANALYSIS_CACHE_DEPTH,
    MIN_POSITION_VALUE,
    MAX_POSITION_VALUE,
    QUIESCENCE_EXTENSION_DEPTH,
    MxGame as default
};
