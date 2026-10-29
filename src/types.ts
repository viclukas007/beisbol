export type Stats = Record<'jj'|'ab'|'hits'|'singles'|'doubles'|'triples'|'hr'|'rbi'|'avg'|'ip'|'er'|'bb'|'k'|'era'|'w'|'l', number>;
export type Team = { id: number; name: string; color: string };
export type Player = { id: number; name: string; originalName: string; teamId: number; placeholder: boolean; sourceCell: string; stats: Stats; version: number; rosterVersion:number; active:boolean; member:boolean|null };
export type Round = { playerId: number; round: number; stats: Stats; sourceCell: string; version: number };
// homeHits/awayHits y homeErrors/awayErrors son los totales por equipo de la hoja de resultados; homePlayerHits/awayPlayerHits suman las capturas individuales.
export type Game = {id:number;turn:1|2;round:number;date:string;time:string;homeTeamId:number;awayTeamId:number;homeScore:number|null;awayScore:number|null;homeHits:number|null;awayHits:number|null;homeErrors:number|null;awayErrors:number|null;homePlayerHits:number|null;awayPlayerHits:number|null;notes:string;status:'scheduled'|'postponed'|'completed'|'cancelled';sourceCell:string|null;deletedAt:string|null;updatedAt:string;version:number};
export type League={name:string;version:number;logoUrl:string|null;rulesNotes:string;standingsOrder:Record<string,number[]>};
export type GameHit={gameId:number;playerId:number;name:string;teamId:number;hits:number;version:number;deletedAt:string|null};
export type Change = {id:string;entity:string;entityId:string;operation:string;before:unknown;after:unknown;responsible:string;createdAt:string};
export type ScheduleTurn={sheet:string;gameCount:number;rounds:number[];start:string;end:string};
export type Snapshot = { league:League; source: string; updatedAt: string; metadata: { namedPlayers: number; placeholderSlots: number; rosterSlots: number; roundRows: number; roundsWithActivity: number[]; minimumAb: number; minimumIp: number; eraInnings: number; masterDifferences: unknown[] }; teams: Team[]; players: Player[]; rounds: Round[]; games:Game[]; gameHits:GameHit[]; schedule:{source:string;season:string;sheets?:string[];resultsSheet?:string;gameCount:number;resultCount?:number;notes:string[];turns?:Record<string,ScheduleTurn>} };
