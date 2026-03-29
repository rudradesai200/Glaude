// ===== shared =====
declare const b: unique symbol;
type Brand<T, K> = T & { readonly [b]: K };

export type PlayerId = Brand<string,"PlayerId">;
export type SessionId = Brand<string,"SessionId">;
export type GameId = Brand<string,"GameId">;

export const PlayerId:(s:string)=>PlayerId;
export const SessionId:(s:string)=>SessionId;
export const GameId:(s:string)=>GameId;

export type Result<T,E>={ok:true,value:T}|{ok:false,error:E};
export const ok:<T>(v:T)=>{ok:true,value:T};
export const err:<E>(e:E)=>{ok:false,error:E};
export const isOk:<T,E>(r:Result<T,E>)=>r is {ok:true,value:T};
export const isErr:<T,E>(r:Result<T,E>)=>r is {ok:false,error:E};

export class GlaudeError extends Error{code:string;constructor(m:string,c:string,o?:ErrorOptions)}

export type GamePhase="CREATED"|"LOBBY"|"PLAYING"|"FINISHED"|"CANCELLED"|"FORFEITED";
export type GameOutcome=
 |{kind:"WIN";winner:PlayerId}
 |{kind:"DRAW"}
 |{kind:"FORFEIT";winner:PlayerId;forfeiter:PlayerId};

export type PlayerSeat={playerId:PlayerId;seatIndex:number};

// ===== engine =====
export interface GameDefinition<S,M,R>{
 id:GameId;displayName:string;
 players:{min:2;max:number};
 initialState(seats:readonly PlayerSeat[]):S;
 validateMove(s:S,m:M,p:PlayerId):Result<void,string>;
 applyMove(s:S,m:M,p:PlayerId):S;
 legalMoves(s:S,p:PlayerId):readonly M[];
 currentTurn(s:S):PlayerId;
 outcome(s:S):GameOutcome|null;
 buildRenderContext(s:S,seats:readonly PlayerSeat[]):R;
 render(ctx:R):Promise<Uint8Array>;
 serializeState(s:S):string;deserializeState(raw:string):S;
 serializeMove(m:M):string;deserializeMove(raw:string):M;
}

// ===== abalone =====
export type AxialCoord={q:number;r:number};
export type HexDir=0|1|2|3|4|5;

export type Cell=
 |{kind:"empty"}
 |{kind:"marble";owner:PlayerId};

export type AbaloneState={
 board:Map<string,Cell>;
 turn:PlayerId;
 capturedBy:Record<string,number>;
 moveNumber:number;
};

export type AbaloneMove={
 type:"inline"|"broadside";
 marbles:readonly AxialCoord[];
 direction:HexDir;
};

export type AbaloneRenderContext={
 state:AbaloneState;
 players:{playerId:PlayerId;seatIndex:number}[];
};

export const HEX_DIRECTIONS:readonly AxialCoord[];
export const opposite:(d:HexDir)=>HexDir;
export const coordKey:(c:AxialCoord)=>string;
export const parseKey:(k:string)=>AxialCoord;
export const addCoord:(a:AxialCoord,b:AxialCoord)=>AxialCoord;
export const step:(c:AxialCoord,d:HexDir)=>AxialCoord;
export const VALID_CELLS:ReadonlySet<string>;
export const isOnBoard:(c:AxialCoord)=>boolean;

export const initialBoard:(b:PlayerId,w:PlayerId)=>Map<string,Cell>;
export const countMarbles:(b:Map<string,Cell>,o:PlayerId)=>number;
export const initialState:(b:PlayerId,w:PlayerId)=>AbaloneState;

export const validateMove:(s:AbaloneState,m:AbaloneMove)=>Result<void,string>;
export const applyMove:(s:AbaloneState,m:AbaloneMove)=>AbaloneState;
export const isWon:(s:AbaloneState)=>PlayerId|null;
export const legalMoves:(s:AbaloneState)=>AbaloneMove[];

export const renderAbalone:(c:AbaloneRenderContext)=>Promise<Uint8Array>;
export const abaloneDefinition:GameDefinition<AbaloneState,AbaloneMove,AbaloneRenderContext>;

// ===== bot db (collapsed) =====
type Col<T>={type:T;pk?:1;opt?:1};
type Table<T>=T;

export const players:Table<{
 discordId:Col<string>&{pk:1};
 username:Col<string>;
 createdAt:Col<Date>;
}>;

export const gameSessions:Table<{
 id:Col<string>&{pk:1};
 gameId:Col<string>;
 channelId:Col<string>;
 phase:Col<string>;
 state:Col<string>&{opt:1};
 messageId:Col<string>&{opt:1};
 winnerId:Col<string>&{opt:1};
 forfeiter:Col<string>&{opt:1};
 createdAt:Col<Date>;
 updatedAt:Col<Date>;
}>;

export const sessionPlayers:Table<{
 sessionId:Col<string>;
 playerId:Col<string>;
 seatIndex:Col<number>;
}>;

export const moveHistory:Table<{
 id:Col<number>&{pk:1};
 sessionId:Col<string>;
 playerId:Col<string>;
 moveData:Col<string>;
 moveNumber:Col<number>;
 createdAt:Col<Date>;
}>;

export const playerStats:Table<{
 playerId:Col<string>;
 gameId:Col<string>;
 wins:Col<number>;
 losses:Col<number>;
 draws:Col<number>;
 elo:Col<number>;
}>;

// ===== db =====
export type Db=any;
export const createDb:(p:string)=>Db;

// ===== repository =====
export const ensurePlayer:(db:Db,id:PlayerId,u:string)=>void;
export const persistLobby:(db:Db,s:any)=>void;
export const addSessionPlayer:(db:Db,id:string,seat:PlayerSeat)=>void;
export const persistPlaying:(db:Db,s:any)=>void;
export const persistMoveAndState:(db:Db,s:any,p:PlayerId,m:string,n:number)=>void;
export const persistEnded:(db:Db,s:any)=>void;
export const updateMessageId:(db:Db,id:string,m:string)=>void;

export type RecoveredSession={phase:"LOBBY"|"PLAYING";row:any;seats:any[]};
export const loadActiveSessions:(db:Db)=>RecoveredSession[];

// ===== registry =====
export const findGame:(id:string)=>GameDefinition<any,any,any>|undefined;
export const listGames:()=>readonly string[];

// ===== commands =====
type I=any;type SM=any;
export const executeStart:(i:I,s:SM,db:Db)=>Promise<void>;
export const executeJoin:(i:I,s:SM,db:Db)=>Promise<void>;
export const executeForfeit:(i:I,s:SM)=>Promise<void>;
export const executeStatus:(i:I,s:SM)=>Promise<void>;
export const executeMove:(i:I,s:SM)=>Promise<void>;

// ===== session manager =====
export type LobbySession={
 phase:"LOBBY";channelId:string;sessionId:string;
 gameId:GameId;hostId:PlayerId;
 seats:readonly PlayerId[];messageId?:string;
};

export type PlayingSession={
 phase:"PLAYING";channelId:string;sessionId:string;
 gameId:GameId;seats:readonly PlayerSeat[];
 definition:GameDefinition<any,any,any>;
 state:unknown;messageId?:string;
};

export type EndedSession={
 phase:"FINISHED"|"FORFEITED";channelId:string;sessionId:string;
 gameId:GameId;seats:readonly PlayerSeat[];
 outcome:GameOutcome;messageId?:string;
};

export type Session=LobbySession|PlayingSession|EndedSession;

export class SessionManager{
 constructor(db:Db);
 recover():void;
 createLobby(c:string,g:string,h:PlayerId):Result<LobbySession,string>;
 joinLobby(c:string,p:PlayerId):Result<LobbySession|PlayingSession,string>;
 forfeit(c:string,p:PlayerId):Result<EndedSession,string>;
 makeMove(c:string,p:PlayerId,m:unknown):Result<{session:PlayingSession|EndedSession;renderCtx:unknown},string>;
 autoJoin(c:string,g:string,p:PlayerId,u:string):Result<LobbySession|PlayingSession,string>;
 setMessageId(c:string,m:string):void;
 getSession(c:string):Session|undefined;
 getSessionBySessionId(id:string):Session|undefined;
 getChannelId(id:string):string|undefined;
}

// ===== ws/api =====
export const startWsServer:(s:SessionManager)=>any;
export const startApiServer:()=>void;

// ===== activity =====
export type SdkAuth={
 userId:string;username:string;
 avatarUrl:string|null;sessionId:string|null;
 wsUrl?:string;
};

export const initDiscordSdk:()=>Promise<SdkAuth>;
export const getDiscordSdk:()=>any;

export const HEX_RADIUS=32;
export const SVG_WIDTH=560,SVG_HEIGHT=600;
export const CX:number,CY:number;

export const axialToPixel:(c:AxialCoord)=>{x:number;y:number};
export const hexVertices:(x:number,y:number,r?:number)=>string;
export const directionVector:(d:HexDir)=>{dx:number;dy:number};

export const BLACK_ID:PlayerId;
export const WHITE_ID:PlayerId;

export type GameOver={kind:"WIN"|"FORFEIT"|"DRAW";winner?:string;forfeiter?:string};

export const GameProvider:(p:{auth:SdkAuth;children:any})=>any;
export const useGame:()=>any;

export const BoardSVG:()=>any;
export const HUD:()=>any;
export const WinScreen:()=>any;
export const InfoModal:(p:{onClose:()=>void})=>any;
export const App:(p:{auth:SdkAuth})=>any;