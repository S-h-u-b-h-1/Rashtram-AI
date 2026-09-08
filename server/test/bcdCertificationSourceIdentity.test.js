const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { toPublicSource, getSourceContext, fetchPublicSource, extractHtml } = require('../research/sourceService');
const { extractStructuredHtml } = require('../document/htmlResourceService');
const { assessExternalSourceQuality, classifyDetailedAuthority, publicAuthorityLabel, toRetrievalAuthorityClass } = require('../research/sourceQuality');

test('uploaded identity wins over absent or erroneous legacy authority in API and citations', async () => {
  for (const metadata of [{}, {authorityClass:'OFFICIAL_PRIMARY',publicAuthorityLabel:'Official government source'}]) {
    const source=toPublicSource({id:1,source_type:'pdf_upload',metadata_json:metadata,status:'ready'});
    assert.equal(source.authorityClass,'USER_SOURCE');
    assert.equal(source.sourceLabel,'User-uploaded source');
    assert.equal(source.metadata.authorityClass,'USER_SOURCE');
    const result=await getSourceContext(42,[1],'consent',{queryFn:async()=>({rows:[{
      id:1,title:'Research note',source_type:'pdf_upload',source_metadata_json:metadata,
      content:'The research team proposes obtaining participant consent before interviews.',chunk_index:0,chunk_metadata_json:{page:1},
    }]})});
    assert.equal(result.evidence[0].authorityClass,'USER_SOURCE');
    assert.equal(result.evidence[0].sourceLabel,'User-uploaded source');
  }
  assert.equal(classifyDetailedAuthority({sourceType:'pdf_upload',sourceUrl:'https://rbi.org.in'}),'USER_SOURCE');
  assert.equal(toRetrievalAuthorityClass('OFFICIAL_PRIMARY','pdf_upload'),'USER_SOURCE');
  assert.equal(publicAuthorityLabel('USER_SOURCE'),'User-uploaded source');
});

test('HTTP 200 official-origin poor HTML remains LOW_QUALITY and NOT_USABLE through real extraction and authority paths', async t => {
  const url=new URL('https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=fixture');
  const html='<html><body><main><p>Administrative notice text is incomplete and unavailable here.</p></main></body></html>';
  t.mock.method(axios,'get',async requested=>{
    assert.equal(requested,url.href);
    return {status:200,headers:{'content-type':'text/html'},data:Buffer.from(html)};
  });
  const fetched=await fetchPublicSource(url);
  assert.equal(fetched.response.status,200);
  const extracted=extractStructuredHtml({html:fetched.response.data.toString(),url:fetched.url});
  assert.ok(extracted.text.length>=40);
  assert.equal(extracted.quality.valid,false);
  assert.equal(extracted.quality.dynamicShell,false);
  const quality=assessExternalSourceQuality({sourceUrl:fetched.url,extracted,sourceType:'external_url'});
  assert.equal(quality.fetchStatus,'SUCCESS');
  assert.equal(quality.authorityClass,'OFFICIAL_REGULATORY');
  assert.equal(toRetrievalAuthorityClass(quality.authorityClass),'PRIMARY_OFFICIAL');
  assert.equal(quality.extractionStatus,'LOW_QUALITY');
  assert.equal(quality.evidenceStatus,'NOT_USABLE');
  assert.throws(()=>extractHtml(fetched.response.data,fetched.url),error=>
    error.details.fetchStatus==='SUCCESS' && error.details.extractionStatus==='LOW_QUALITY'
      && error.details.evidenceStatus==='NOT_USABLE');
});
