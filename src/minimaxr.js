import 'babel-polyfill';

const minimumSearchDepth = 5;
const maximumSearchDepth = 9;
const useProgressiveDeepening = true;
const useQuiescenceSearch = true;
const useAlphaBetaPruning = true;
const useAnalysisCache = true;
const useSingularExtensions = false;
const analysisCacheSize = 4000;
const minAnalysisCacheDepth = 3;
const useAdvancedAnalysisCacheAging = false;
const useOpponentModeling = true;
const quiescenceExtensionDepth = 2; //the number of search levels to add when a quiescence search extension is required
const minimumPositionValue = -999;
const maximumPositionValue = 999;
const minimumManCount = 2;
const initialManCount = 20;

const northEast = 0;
const southEast = 1;
const southWest = 2;
const northWest = 3;

var AnalysisCache = new MxAnalysisCache();

function MxAnalysisCache()
{
    this.Nodes = new Array();	
	
	this.Cursor = 0;
	this.RetrieveAnalysis = function(player, depth, position)
	{
		for (var n in this.Nodes)
		{
			var entry = this.Nodes [n];
			if (entry.Player !== player) continue;
			if (entry.Depth < depth) continue;
			if (!entry.Position.Equals(position)) continue;
			return entry.Analysis;
		}
		return null;
	}	
	this.CacheAnalysis = function cacheAnalysis(player, depth, position, analysis)
	{
		var myentry = new Object();
		myentry.Depth = depth;
		myentry.Position = position.Clone();
		myentry.Analysis = analysis;
		if (this.Cursor >= analysisCacheSize) this.Cursor=0;
		this.Nodes[this.Cursor] = myentry;
		this.Cursor++;
	}	
}

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
	this.Nodes = new Array();	
	for (var sq=0; sq<=40; sq = NextSquare(sq))
	{
		this.Nodes[sq] = 1; //white pawn
	}
	for (var sq=40; sq<60; sq = NextSquare(sq))
	{
		this.Nodes[sq] = 0; //no mans land
	}
	for (var sq=60; sq<100; sq = NextSquare(sq))
	{
		this.Nodes[sq] = -1; //black pawns
	}	
	
	this.LegalMovesX = function(player, square, direction, captureMode)
	{
		try
		{
			var legalMoves = new Array();
			for (var sq=0; sq<100; sq=NextSquare(sq))
			{
				var man = this.Nodes[sq];
				if (!(player*man>0 && (square==sq || square==null))) continue;
				for ( var dir=0; dir<4; dir++ )
				{				
					if (!((IsLegalDirection(player, dir) || IsKing(man) || captureMode) && (direction==dir || direction==null))) continue;
					if (captureMode)
					{
						var moveSegment = new Array();					
						var capture = this.GetCapture(sq, dir);
						var perpendicularContinuationsFound=false;
						var lastLandingSquare = null;
						if (capture==null) continue;						
						do
						{						
							perpendicularContinuationsFound=false;
							moveSegment = moveSegment.concat(capture);
							this.ExecuteMove(capture);
							lastLandingSquare = moveSegment[moveSegment.length-3];
							do
							{
								var legalContinuations = this.LegalMovesX(player, TerminalSquare(moveSegment), PreviousDirection(dir), true);
								legalContinuations = legalContinuations.concat(this.LegalMovesX(player, TerminalSquare(moveSegment), NextDirection(dir), true));
								for (var m in legalContinuations)
								{
									legalMoves[legalMoves.length] = NormalizeMove(moveSegment.concat(legalContinuations[m]));
									perpendicularContinuationsFound = true;
								}
							}	
							while (this.AdvanceTerminalSquare(moveSegment, dir)); //attempts to advance terminal square forward by 1 and re-execute
							capture = this.GetCapture(TerminalSquare(moveSegment), dir);						
						}
						while (capture != null);
						if (!perpendicularContinuationsFound)
						{
							legalMoves[legalMoves.length] = NormalizeMove(moveSegment);
							while (TerminalSquare(moveSegment) !== lastLandingSquare)
							{
								var bb = this.AdvanceTerminalSquare(moveSegment, OppositeDirection(dir)); 
								legalMoves[legalMoves.length] = NormalizeMove(moveSegment);
							}
						}						
						this.UndoMove(NormalizeMove(moveSegment));						
					}
					else //non capture mode
					{
						var nextSquare = NextSquare(sq, dir, 1);
						while (this.IsFreeSquare(nextSquare))
						{
							legalMoves[legalMoves.length] = NormalizeMove(new Array(sq, man, 0, nextSquare, 0, man));
							if (!IsKing(man)) break;
							nextSquare = NextSquare(nextSquare, dir, 1);
						}					
					}
				}						
			}
			return legalMoves;
		}
		catch (err) {alert('LegalMovesX Error: '+err); }
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
	this.Clone = function()
	{
		var p = new MxPosition;
		for (var s=0; s<100; s=NextSquare(s)) {p.Nodes[s] = this.Nodes[s];}
		return p;		
	};
	this.Equals = function(pos)
	{
		for (var s=0; s<100; s=NextSquare(s)) { if (pos.Nodes[s] != this.Nodes[s]) return false;}
		return true;
	};
	this.Analysis = function(player, depth, parentBestValue, parentDepth, untilQuiescent)
    { 	
    	try
    	{
    		var legalMoves = this.LegalMoves(player);
    		if (legalMoves.length === 0) return new MxPositionAnalysis(minimumPositionValue, minimumPositionValue, minimumPositionValue, null);
    		if (depth >= minAnalysisCacheDepth && useAnalysisCache)
    		{
    			var cachedAnalysis = AnalysisCache.RetrieveAnalysis(player, depth, this);
    			if (cachedAnalysis != null) return cachedAnalysis;
    		}
    		if (depth === 0)
    		{
				if (!(untilQuiescent && parentDepth < maximumSearchDepth && CaptureCount(legalMoves[0]) > 0)) 
	    			return new MxPositionAnalysis(this.StaticValue(player), this.StaticValue(player), minimumPositionValue, legalMoves[0]);
	    		else
	    			depth = quiescenceExtensionDepth;			
    		}    	
    		var bestValue = maximumPositionValue;
    		var bestPotentialValue = maximumPositionValue;
    		var bestChildMove = null;
    		var myPotentialValue = 0;
    		
    		var hit = false;
    		for (var m in legalMoves)
    		{
    			this.ExecuteMove(legalMoves[m]);
    			var analysis = this.Analysis(-player, depth-1, bestValue, parentDepth+1, untilQuiescent);
    			this.UndoMove(legalMoves[m]);
    			myPotentialValue += analysis.PotentialValue;
    			if (analysis.DynamicValue < bestValue || (analysis.DynamicValue==bestValue && analysis.PotentialValue<bestPotentialValue)) 
    			{
    				bestValue = analysis.DynamicValue;
    				bestPotentialValue = analysis.PotentialValue;
    				bestChildMove = legalMoves[m];
    				hit = true;
    			}
    			if ((-bestValue >= parentBestValue) && useAlphaBetaPruning) break;    
    		}
    		if (hit === false) 
    		    console.log('not hit');
    		var myAnalysis = new MxPositionAnalysis(-bestValue, this.StaticValue(player), -myPotentialValue, bestChildMove);
    		if (useAnalysisCache) AnalysisCache.CacheAnalysis(player, depth, this, myAnalysis);
    		return myAnalysis;
    	}
    	catch (err) {alert ('Error performing analysis: '+err); }
	}

    this.ValueProfile = function(player)
	{
		var valueProfile = new Array();
		for (var d=0; d<minimumSearchDepth; d++)
		{
			valueProfile[d] = this.DynamicValue(player, d, maximumPositionValue, 0, false);			
		}
		valueProfile[minimumSearchDepth] = this.DynamicValue(player, d, maximumPositionValue, 0, useQuiescenceSearch);			
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
	};	
	this.StaticValue = function(player)
    {
    	return this.ManCount(player) - this.ManCount(-player); 
    }
    this.GetCapture = function(square, direction)
	{
		try
		{
			var mycapture = null;
			var man = this.Nodes[square];
			var nextSquare = NextSquare(square, direction, 1);
			if (IsKing(man))
			{
				while (this.IsFreeSquare(nextSquare))	
					{nextSquare = NextSquare(nextSquare, direction, 1);}
			}
			var landingSq = NextSquare(nextSquare, direction, 1);			
			if ((this.Nodes[nextSquare] * man < 0) && this.IsFreeSquare(landingSq))
			{
				mycapture = new Array(square, man, 0, nextSquare, this.Nodes[nextSquare], 0, landingSq, 0, man );
			}
			return mycapture;
		}
		catch (err) {alert('GetCapture error'+err); }
	};
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
	this.AdvanceTerminalSquare = function advanceTerminalSquare(move, dir)
	{
		try
		{
			var finalMan = move[move.length-1];
			if (this.Nodes[move[move.length-3]] !== finalMan) alert('AdvanceTerminalSquare problem');
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
    this.MoveHistory = new Array();
	this.Position = new MxPosition();
	this.Turn = -1;

	this.BestMove = function()
	{
		return this.Position.Analysis(this.Turn, minimumSearchDepth, maximumPositionValue, 0, useQuiescenceSearch).BestMove;
	}
	this.TryAcceptMove = function(startSquare, endSquare)
	{
		var legalMoves = this.Position.LegalMoves(this.Turn);
		for (var m in legalMoves)
		{
			var move = legalMoves[m];
		    if (move[0] === startSquare && move[move.length - 3] === endSquare) {
		        this.Position.ExecuteMove(move);
		        this.MoveHistory[this.MoveHistory.length] = move;
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
		for (var x=3; x < move.length-3; x+=3)
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
		if (!IsKing(mv[mv.length-1]) && ((rootMan==1 && mv[mv.length-3]>=91) || (rootMan==-1 && mv[mv.length-3]<=8)))	
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
			case northEast: return sq+9*steps;
			case southEast: return sq-11*steps;
			case southWest: return sq-9*steps;
			case northWest: return sq+11*steps;
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
function IsLegalDirection(player, dir){	return ((player === 1)?(dir === northEast || dir === northWest): (dir === southEast || dir === southWest)); }

function Stealth(valueProfile)
{
	return valueProfile.avg() - valueProfile.last();
}

//function negaStealth(valueProfile)
//{
//    return valueProfile.avg() - valueProfile.last();
//}
//function posiStealth(valueProfile)
//{
//    return valueProfile.avg() - valueProfile.last();
//}


export default MxGame;
