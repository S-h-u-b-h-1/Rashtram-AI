const express = require('express');
const {
  storeBillContentInChunks,
  generateBillSummary,
  checkBillExists,
  createProbeVector,
  getIndex
} = require('../lib/vectordb');
const { pdfProcessor } = require('../lib/pdfProcessor');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    console.log('📄 Process Bill API called');

    const { billId, pdfUrl, title } = req.body;
    console.log('Request data:', {
      billId,
      pdfUrl: pdfUrl ? pdfUrl.substring(0, 50) + '...' : null,
      title
    });

    if (!billId || !pdfUrl) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Bill ID and PDF URL are required' });
    }


    const existenceCheck = await checkBillExists(billId);

    if (existenceCheck.exists) {
      console.log(`⚠️ Bill ${billId} already exists with ${existenceCheck.chunksCount} chunks`);


      if (existenceCheck.summary) {
        console.log('✅ Using existing summary from database (fast path)');
        return res.json({
          success: true,
          message: `Bill ${billId} already exists in database`,
          chunksStored: existenceCheck.chunksCount || 0,
          summary: existenceCheck.summary,
          vectorStorage: true,
          processingMethod: 'existing-data-with-summary',
          alreadyProcessed: true,
          billTitle: existenceCheck.billTitle,
          lastProcessed: existenceCheck.lastProcessed,
        });
      }


      try {
        const index = getIndex();
        const contentQuery = await index.query({
          vector: createProbeVector(),
          topK: 5,
          filter: { billId: { $eq: billId.toString() } },
          includeMetadata: true,
        });

        if (contentQuery.matches && contentQuery.matches.length > 0) {

          const existingSummary = contentQuery.matches[0].metadata.summary;

          if (existingSummary) {
            console.log('✅ Using existing summary from database');
            return res.json({
              success: true,
              message: `Bill ${billId} already exists in database`,
              chunksStored: existenceCheck.chunksCount || 0,
              summary: existingSummary,
              vectorStorage: true,
              processingMethod: 'existing-data-with-summary',
              alreadyProcessed: true,
              billTitle: existenceCheck.billTitle,
              lastProcessed: existenceCheck.lastProcessed,
            });
          }


          const contextText = contentQuery.matches
            .map(match => match.metadata.content || match.metadata.text || '')
            .filter(Boolean)
            .join('\n\n');

          if (contextText) {
            console.log('🧠 Generating summary for existing bill...');
            const aiSummary = await generateBillSummary(
              contextText,
              title || existenceCheck.billTitle
            );


            try {
              const index = getIndex();
              const allChunks = await index.query({
                vector: createProbeVector(),
                topK: 100,
                filter: { billId: { $eq: billId.toString() } },
                includeMetadata: true,
              });

              if (allChunks.matches && allChunks.matches.length > 0) {

                for (const match of allChunks.matches) {
                  await index.update({
                    id: match.id,
                    metadata: {
                      ...match.metadata,
                      summary: aiSummary,
                    }
                  });
                }
                console.log(`✅ Updated ${allChunks.matches.length} chunks with summary`);
              }
            } catch (updateError) {
              console.error('⚠️ Failed to update chunks with summary:', updateError.message);

            }

            return res.json({
              success: true,
              message: `Bill ${billId} already exists in database`,
              chunksStored: existenceCheck.chunksCount || 0,
              summary: aiSummary,
              vectorStorage: true,
              processingMethod: 'existing-data-with-summary',
              alreadyProcessed: true,
              billTitle: existenceCheck.billTitle,
              lastProcessed: existenceCheck.lastProcessed,
            });
          }
        }
      } catch (summaryError) {
        console.error('⚠️ Error generating summary from existing content:', summaryError);
      }


      return res.json({
        success: true,
        message: `Bill ${billId} already exists in database`,
        chunksStored: existenceCheck.chunksCount || 0,
        summary: null,
        vectorStorage: true,
        processingMethod: 'existing-data-with-summary',
        alreadyProcessed: true,
        billTitle: existenceCheck.billTitle,
        lastProcessed: existenceCheck.lastProcessed,
      });
    }


    console.log('🔧 Processing PDF content with chunking...');
    const processedData = await pdfProcessor.processPDFAndCreateChunks(pdfUrl, billId, title);
    console.log(`✅ Processed ${processedData.totalChunks} chunks`);

    console.log('🧠 Generating AI summary...');
    const contextText = processedData.chunks
      .slice(0, 3)
      .map(chunk => chunk.content)
      .join('\n\n');
    const aiSummary = await generateBillSummary(contextText, title);


    const chunksWithSummary = processedData.chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        summary: aiSummary,
      }
    }));

    console.log('💾 Storing chunks in vector database with summary...');
    const result = await storeBillContentInChunks(chunksWithSummary);

    console.log(`🎉 Successfully processed bill ${billId}`);

    return res.json({
      success: true,
      message: `Successfully processed bill ${billId} with full content chunking`,
      chunksStored: result.chunksStored,
      totalChunks: processedData.totalChunks,
      originalLength: processedData.originalLength,
      summary: aiSummary,
      vectorStorage: true,
      processingMethod: 'full-pdf-chunking',
      pdfMetadata: processedData.pdfMetadata,
    });

  } catch (error) {
    console.error('❌ Error processing bill:', error);
    res.status(500).json({
      error: `Failed to process bill: ${error.message}`,
    });
  }
});

module.exports = router;
