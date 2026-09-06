const {selectContextPassages}=require('./contextBuilder');
const {assessEvidenceSufficiency}=require('./evidenceSafetyService');
// Fixed synthetic evidence only: no user input, database access, model calls,
// source processing or persistence. Mounted behind the existing account auth.
const numericSafetyProbe=()=>{
 const passages=selectContextPassages([30,60].map((days,chunkIndex)=>({
  id:'fixture-'+chunkIndex,documentId:'synthetic-control',chunkIndex,
  content:`Clause 2.1 Filing deadline: The company shall file its report within ${days} days.`,
 })));
 const result=assessEvidenceSufficiency('Compare the filing deadline.',passages,{queryType:'COMPARISON',retrievalVerified:true});
 return {ok:passages.length===2&&result.level==='CONFLICTING',fixture:'same-provision-deadline-v1',retainedPassages:passages.length,decision:result.level};
};
module.exports={numericSafetyProbe};
