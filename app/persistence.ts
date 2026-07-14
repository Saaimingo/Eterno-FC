import type { GameState } from "./domain/types";

const DATABASE_NAME="eterno-fc";
const DATABASE_VERSION=1;
const STORE_NAME="application";
const STATE_KEY="careers";

export type PersistedCareerState={careers:GameState[];activeId:string};

function openDatabase(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(DATABASE_NAME,DATABASE_VERSION);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE_NAME))request.result.createObjectStore(STORE_NAME);};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error("Não foi possível abrir o banco de saves."));
  });
}

export async function loadCareerState():Promise<PersistedCareerState|undefined>{
  const database=await openDatabase();
  try{
    return await new Promise<PersistedCareerState|undefined>((resolve,reject)=>{
      const transaction=database.transaction(STORE_NAME,"readonly"),request=transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess=()=>resolve(request.result as PersistedCareerState|undefined);
      request.onerror=()=>reject(request.error??new Error("Não foi possível carregar os saves."));
    });
  }finally{database.close();}
}

export async function saveCareerState(state:PersistedCareerState){
  const database=await openDatabase();
  try{
    await new Promise<void>((resolve,reject)=>{
      const transaction=database.transaction(STORE_NAME,"readwrite");
      transaction.objectStore(STORE_NAME).put(state,STATE_KEY);
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error??new Error("Não foi possível salvar as carreiras."));
      transaction.onabort=()=>reject(transaction.error??new Error("A gravação das carreiras foi interrompida."));
    });
  }finally{database.close();}
}
