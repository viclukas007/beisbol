import type {Snapshot} from './types';

// Jornadas disponibles para capturar estadísticas: el servidor crea una fila por jugador
// hasta la última jornada del rol (mínimo 30), así que basta con leer la mayor que llega.
export function statRounds(data:Snapshot):number[] {
  let last=30;
  for(const row of data.rounds)if(row.round>last)last=row.round;
  return Array.from({length:last},(_,i)=>i+1);
}
