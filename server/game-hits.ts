import type {Express} from 'express';
import type {Pool} from 'pg';
import {InputError,audit,transaction} from './writes.ts';
export function registerGameHits(app:Express,pool:Pool) {
  app.put('/api/games/:gameId/players/:playerId/hits',async(req,res)=>{
    const gameId=Number(req.params.gameId),playerId=Number(req.params.playerId);
    const {hits,version,gameVersion}=req.body??{};
    if(!Number.isInteger(gameId)||gameId<1||!Number.isInteger(playerId)||playerId<1)throw new InputError('Juego o jugador no válido.');
    if(hits!==null&&(!Number.isInteger(hits)||hits<0||hits>9999))throw new InputError('Captura los hits como entero entre 0 y 9999.');
    if(!Number.isInteger(version)||version<0)throw new InputError('Versión de captura no válida.');
    const result=await transaction(pool,async c=>{
      const game=(await c.query('SELECT * FROM games WHERE id=$1 FOR UPDATE',[gameId])).rows[0];
      if(!game||game.deleted_at)throw new InputError('Juego no disponible.',404);
      if(game.version!==gameVersion)throw new InputError('El juego cambió. Actualiza antes de capturar.',409);
      if(game.status!=='completed')throw new InputError('Finaliza el juego y captura su marcador antes de registrar hits.');
      const player=(await c.query('SELECT * FROM players WHERE id=$1 FOR SHARE',[playerId])).rows[0];
      if(!player)throw new InputError('Jugador no encontrado.',404);
      const before=(await c.query('SELECT * FROM game_player_hits WHERE game_id=$1 AND player_id=$2 FOR UPDATE',[gameId,playerId])).rows[0];
      if((before?.version??0)!==version)throw new InputError('Los hits de este jugador cambiaron. Actualiza antes de guardar.',409);
      if(hits===null) {
        if(!before||before.deleted_at)return {changed:false};
        await c.query('UPDATE game_player_hits SET deleted_at=now(),version=version+1,updated_at=now() WHERE game_id=$1 AND player_id=$2',[gameId,playerId]);
        await audit(c,'game_hits',`${gameId}:${playerId}`,'remove',before,null,res.locals.auth.email);return {changed:true};
      }
      const team=before?.team_id??player.team_id;
      if(![game.home_team_id,game.away_team_id].includes(team))throw new InputError('El jugador no pertenece a los equipos de este partido.');
      if(!before&&(!player.active||player.placeholder))throw new InputError('Solo puedes agregar jugadores activos con nombre.');
      if(before&&!before.deleted_at&&before.hits===hits)return {changed:false};
      const after=(await c.query(`INSERT INTO game_player_hits(game_id,player_id,team_id,hits) VALUES($1,$2,$3,$4) ON CONFLICT(game_id,player_id) DO UPDATE SET hits=EXCLUDED.hits,deleted_at=NULL,version=game_player_hits.version+1,updated_at=now() RETURNING *`,[gameId,playerId,team,hits])).rows[0];
      await audit(c,'game_hits',`${gameId}:${playerId}`,before?'update':'create',before,after,res.locals.auth.email);return {changed:true};
    });res.json(result);
  });
}
