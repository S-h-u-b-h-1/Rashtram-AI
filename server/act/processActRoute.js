const express = require('express');
const {
  storeActContentInChunks,
  generateActSummary,
  checkActExists,
  getActIndex
} = require('../lib/vectordb');
const { pdfProcessor } = require('../lib/pdfProcessor');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    console.log('📄 Process Act API called');

    const { actId, pdfUrl, title } = req.body;
    console.log('Request data:', {
      actId,
      pdfUrl: pdfUrl ? pdfUrl.substring(0, 50) + '...' : null,
      title
    });

    if (!actId || !pdfUrl) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Act ID and PDF URL are required' });
    }


    const existenceCheck = await checkActExists(actId);

    if (existenceCheck.exists) {
      console.log(`⚠️ Act ${actId} already exists with ${existenceCheck.chunksCount} chunks`);


      if (existenceCheck.summary) {
        console.log('✅ Using existing summary from database (fast path)');
        return res.json({
          success: true,
          message: `Act ${actId} already exists in database`,
          chunksStored: existenceCheck.chunksCount || 0,
          summary: existenceCheck.summary,
          vectorStorage: true,
          processingMethod: 'existing-data-with-summary',
          alreadyProcessed: true,
          actTitle: existenceCheck.actTitle,
          lastProcessed: existenceCheck.lastProcessed,
        });
      }


      try {
        const index = getActIndex();
        const contentQuery = await index.query({
          vector: new Array(768).fill(0),
          topK: 5,
          filter: { actId: { $eq: actId.toString() } },
          includeMetadata: true,
        });

        if (contentQuery.matches && contentQuery.matches.length > 0) {

          const existingSummary = contentQuery.matches[0].metadata.summary;

          if (existingSummary) {
            console.log('✅ Using existing summary from database');
            return res.json({
              success: true,
              message: `Act ${actId} already exists in database`,
              chunksStored: existenceCheck.chunksCount || 0,
              summary: existingSummary,
              vectorStorage: true,
              processingMethod: 'existing-data-with-summary',
              alreadyProcessed: true,
              actTitle: existenceCheck.actTitle,
              lastProcessed: existenceCheck.lastProcessed,
            });
          }


          const contextText = contentQuery.matches
            .map(match => match.metadata.content || match.metadata.text || '')
            .filter(Boolean)
            .join('\n\n');

          if (contextText) {
            console.log('🧠 Generating summary for existing act...');
            const aiSummary = await generateActSummary(
              contextText,
              title || existenceCheck.actTitle
            );


            try {
              const index = getActIndex();
              const allChunks = await index.query({
                vector: new Array(768).fill(0),
                topK: 100,
                filter: { actId: { $eq: actId.toString() } },
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
              message: `Act ${actId} already exists in database`,
              chunksStored: existenceCheck.chunksCount || 0,
              summary: aiSummary,
              vectorStorage: true,
              processingMethod: 'existing-data-with-summary',
              alreadyProcessed: true,
              actTitle: existenceCheck.actTitle,
              lastProcessed: existenceCheck.lastProcessed,
            });
          }
        }
      } catch (summaryError) {
        console.error('⚠️ Error generating summary from existing content:', summaryError);
      }


      return res.json({
        success: true,
        message: `Act ${actId} already exists in database`,
        chunksStored: existenceCheck.chunksCount || 0,
        summary: null,
        vectorStorage: true,
        processingMethod: 'existing-data-with-summary',
        alreadyProcessed: true,
        actTitle: existenceCheck.actTitle,
        lastProcessed: existenceCheck.lastProcessed,
      });
    }


    console.log('🔧 Processing PDF content with chunking...');
    const processedData = await pdfProcessor.processPDFAndCreateChunks(pdfUrl, actId, title);
    console.log(`✅ Processed ${processedData.totalChunks} chunks`);

    console.log('🧠 Generating AI summary...');
    const contextText = processedData.chunks
      .slice(0, 3)
      .map(chunk => chunk.content)
      .join('\n\n');
    const aiSummary = await generateActSummary(contextText, title);


    const chunksWithSummary = processedData.chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        summary: aiSummary,
      }
    }));

    console.log('💾 Storing chunks in vector database with summary...');
    const result = await storeActContentInChunks(chunksWithSummary);

    console.log(`🎉 Successfully processed act ${actId}`);

    return res.json({
      success: true,
      message: `Successfully processed act ${actId} with full content chunking`,
      chunksStored: result.chunksStored,
      totalChunks: processedData.totalChunks,
      originalLength: processedData.originalLength,
      summary: aiSummary,
      vectorStorage: true,
      processingMethod: 'full-pdf-chunking',
      pdfMetadata: processedData.pdfMetadata,
    });

  } catch (error) {
    console.error('❌ Error processing act:', error);
    res.status(500).json({
      error: `Failed to process act: ${error.message}`,
    });
  }
});

module.exports = router;
