// Snapshot/restore guard around Bukkit-free Bedrock chest transactions.
export function withInventoryRollback(container,mutate){
 const snapshot=[];for(let i=0;i<container.size;i++)snapshot.push(container.getItem(i));
 try{const result=mutate();if(result===false)throw Error('transaction refused');return {ok:true,result};}
 catch(error){let restored=true;for(let i=0;i<snapshot.length;i++)try{container.setItem(i,snapshot[i]);}catch(_){restored=false;}
 return {ok:false,error:String(error),restored};}
}
export function quantity(container,itemId){let n=0;for(let i=0;i<container.size;i++){const s=container.getItem(i);if(s?.typeId===itemId)n+=s.amount;}return n;}
