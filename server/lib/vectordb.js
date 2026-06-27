import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_DIMENSION = 768;


export const getIndex = () => {
  return pinecone.index(process.env.PINECONE_INDEX_NAME || 'rashtram-bills');
};

export const getActIndex = () => {
  return pinecone.index('rashtram-acts');
};


export const checkBillExists = async (billId) => {
  try {
    console.log(`Checking if bill ${billId} already exists in Pinecone...`);
    const index = getIndex();


    const queryResults = await index.query({
      vector: new Array(EMBEDDING_DIMENSION).fill(0),
      topK: 1,
      filter: { billId: { "$eq": billId.toString() } },
      includeMetadata: true,
    });

    const exists = queryResults.matches && queryResults.matches.length > 0;
    console.log(`Bill ${billId} exists in database: ${exists}`);

    if (exists) {
      const metadata = queryResults.matches[0].metadata;
      return {
        exists: true,
        summary: metadata.summary || null,
        billTitle: metadata.billTitle || metadata.title,
        lastProcessed: metadata.timestamp,

        chunksCount: metadata.totalChunks || 'unknown'
      };
    }

    return { exists: false };
  } catch (error) {
    console.error(error);
    return { exists: false };
  }
};

export const checkActExists = async (actId) => {
  try {
    console.log(`Checking if act ${actId} already exists in Pinecone...`);
    const index = getActIndex();


    const queryResults = await index.query({
      vector: new Array(EMBEDDING_DIMENSION).fill(0),
      topK: 1,
      filter: { actId: { "$eq": actId.toString() } },
      includeMetadata: true,
    });

    const exists = queryResults.matches && queryResults.matches.length > 0;
    console.log(`Act ${actId} exists in database: ${exists}`);

    if (exists) {
      const metadata = queryResults.matches[0].metadata;
      return {
        exists: true,
        summary: metadata.summary || null,
        actTitle: metadata.actTitle || metadata.title,
        lastProcessed: metadata.timestamp,

        chunksCount: metadata.totalChunks || 'unknown'
      };
    }

    return { exists: false };
  } catch (error) {
    console.error(error);
    return { exists: false };
  }
};

export const generateEmbedding = async (text) => {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 768,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding failed:', error);
    throw error;
  }
};

export const generateResponse = async (prompt, context = '') => {
  try {
    const fullPrompt = `
Context from bill documents:
${context}

User question: ${prompt}

Please provide a comprehensive answer based on the context provided above. If the context doesn't contain enough information to answer the question, please mention that and provide what information you can based on the available context.
`;

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: fullPrompt }],
      stream: true,
    });

    return stream;
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
};

export const generateBillSummary = async (billContent) => {
  try {
    const prompt = `
Please provide a comprehensive summary of this parliamentary bill. Include:
1. Main purpose and objectives
2. Key provisions
3. Potential impact
4. Important dates or timelines mentioned
5. Any notable changes or amendments

Bill content:
${billContent}

Provide a well-structured summary that's informative yet accessible.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating bill summary:', error);
    throw error;
  }
};

export const generateActSummary = async (actContent) => {
  try {
    const prompt = `
Please provide a comprehensive summary of this parliamentary act. Include:
1. Main purpose and objectives
2. Key provisions and sections
3. Potential impact and applicability
4. Important dates or timelines mentioned
5. Any notable amendments or changes

Act content:
${actContent}

Provide a well-structured summary that's informative yet accessible.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating act summary:', error);
    throw error;
  }
};

export const searchSimilarContent = async (query, billId, topK = 5) => {
  try {
    const index = getIndex();
    const queryEmbedding = await generateEmbedding(query);

    const searchResults = await index.query({
      vector: queryEmbedding,
      topK,
      filter: { billId: { "$eq": billId } },
      includeMetadata: true,
    });

    const matches = searchResults.matches || [];
    const enhancedResults = matches.map(match => ({
      ...match,
      relevanceScore: match.score,
      content: match.metadata?.content || '',
      chunkInfo: {
        index: match.metadata?.chunkIndex || 0,
        total: match.metadata?.totalChunks || 1,
        source: match.metadata?.source || 'pdf'
      }
    }));

    return enhancedResults;
  } catch (error) {
    console.error('Error searching similar content:', error);
    throw error;
  }
};

export const searchSimilarContentForAct = async (query, actId, topK = 5) => {
  try {
    const index = getActIndex();
    const queryEmbedding = await generateEmbedding(query);

    const searchResults = await index.query({
      vector: queryEmbedding,
      topK,
      filter: { actId: { "$eq": actId } },
      includeMetadata: true,
    });

    const matches = searchResults.matches || [];
    const enhancedResults = matches.map(match => ({
      ...match,
      relevanceScore: match.score,
      content: match.metadata?.content || '',
      chunkInfo: {
        index: match.metadata?.chunkIndex || 0,
        total: match.metadata?.totalChunks || 1,
        source: match.metadata?.source || 'pdf'
      }
    }));

    return enhancedResults;
  } catch (error) {
    console.error('Error searching similar content for act:', error);
    throw error;
  }
};

export const storeBillContentInChunks = async (chunks) => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;
  const BATCH_SIZE = 50;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const upsertWithRetry = async (index, vectors, retryCount = 0) => {
    try {
      await index.upsert(vectors);
      return true;
    } catch (error) {
      if (retryCount < MAX_RETRIES && (
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('network') ||
        error.message?.includes('fetch failed')
      )) {
        console.log(`⚠️ Connection error, retrying in ${RETRY_DELAY}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await sleep(RETRY_DELAY * (retryCount + 1));
        return upsertWithRetry(index, vectors, retryCount + 1);
      }
      throw error;
    }
  };

  try {
    console.log(`Storing ${chunks.length} pre-processed chunks in Pinecone...`);

    const index = getIndex();


    let totalStored = 0;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);

      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${batchChunks.length} chunks)...`);

      const vectors = [];
      for (let i = 0; i < batchChunks.length; i++) {
        const chunk = batchChunks[i];
        console.log(`Generating embedding for chunk ${batchStart + i + 1}/${chunks.length} (${chunk.content.length} chars)...`);

        const embedding = await generateEmbedding(chunk.content);
        vectors.push({
          id: chunk.id,
          values: embedding,
          metadata: {
            billId: chunk.billId.toString(),
            billTitle: chunk.title,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            timestamp: new Date().toISOString(),
            ...chunk.metadata,
          },
        });
      }

      console.log(`Upserting ${vectors.length} vectors to Pinecone (batch ${Math.floor(batchStart / BATCH_SIZE) + 1})...`);
      await upsertWithRetry(index, vectors);
      totalStored += vectors.length;

      console.log(`✅ Successfully stored batch (${totalStored}/${chunks.length} total)`);


      if (batchEnd < chunks.length) {
        await sleep(500);
      }
    }

    console.log(`🎉 Successfully stored all ${totalStored} chunks in Pinecone with advanced chunking!`);
    return { chunksStored: totalStored, success: true };

  } catch (error) {
    console.error('Error storing chunked bill content in Pinecone:', error);
    throw error;
  }
};

export const storeActContentInChunks = async (chunks) => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;
  const BATCH_SIZE = 50;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const upsertWithRetry = async (index, vectors, retryCount = 0) => {
    try {
      await index.upsert(vectors);
      return true;
    } catch (error) {
      if (retryCount < MAX_RETRIES && (
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('network') ||
        error.message?.includes('fetch failed')
      )) {
        console.log(`⚠️ Connection error, retrying in ${RETRY_DELAY}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await sleep(RETRY_DELAY * (retryCount + 1));
        return upsertWithRetry(index, vectors, retryCount + 1);
      }
      throw error;
    }
  };

  try {
    console.log(`Storing ${chunks.length} pre-processed act chunks in Pinecone...`);

    const index = getActIndex();


    let totalStored = 0;
    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);

      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${batchChunks.length} chunks)...`);

      const vectors = [];
      for (let i = 0; i < batchChunks.length; i++) {
        const chunk = batchChunks[i];
        console.log(`Generating embedding for chunk ${batchStart + i + 1}/${chunks.length} (${chunk.content.length} chars)...`);

        const embedding = await generateEmbedding(chunk.content);
        vectors.push({
          id: chunk.id,
          values: embedding,
          metadata: {
            actId: chunk.billId.toString(),
            actTitle: chunk.title,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            timestamp: new Date().toISOString(),
            ...chunk.metadata,
          },
        });
      }

      console.log(`Upserting ${vectors.length} vectors to Pinecone (batch ${Math.floor(batchStart / BATCH_SIZE) + 1})...`);
      await upsertWithRetry(index, vectors);
      totalStored += vectors.length;

      console.log(`✅ Successfully stored batch (${totalStored}/${chunks.length} total)`);


      if (batchEnd < chunks.length) {
        await sleep(500);
      }
    }

    console.log(`🎉 Successfully stored all ${totalStored} act chunks in Pinecone with advanced chunking!`);
    return { chunksStored: totalStored, success: true };

  } catch (error) {
    console.error('Error storing chunked act content in Pinecone:', error);
    throw error;
  }
};

export const storeBillContent = async (billId, title, content, metadata = {}) => {
  try {
    console.log(`Storing content for bill ${billId} in Pinecone...`);

    const index = getIndex();

    const chunks = splitIntoChunks(content, 1000);
    console.log(`Content split into ${chunks.length} chunks`);

    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Generating embedding for chunk ${i + 1}/${chunks.length}...`);
      const embedding = await generateEmbedding(chunks[i]);
      vectors.push({
        id: `bill-${billId}-chunk-${i}`,
        values: embedding,
        metadata: {
          billId: billId.toString(),
          billTitle: title,
          content: chunks[i],
          chunkIndex: i,
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });
    }

    console.log(`Upserting ${vectors.length} vectors to Pinecone...`);
    await index.upsert(vectors);

    console.log(`Successfully stored ${vectors.length} chunks for bill ${billId} in Pinecone!`);
    return { chunksStored: vectors.length, success: true };

  } catch (error) {
    console.error('Error storing bill content in Pinecone:', error);
    throw error;
  }
};

const splitIntoChunks = (text, chunkSize = 1000) => {
  const chunks = [];
  const words = text.split(' ');

  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }

  return chunks;
};


export const findSimilarBills = async (billId, billTitle, topK = 5) => {
  try {
    console.log(`🔍 Finding similar bills for: ${billTitle}`);

    const index = getIndex();


    const titleEmbedding = await generateEmbedding(billTitle);



    const queryResults = await index.query({
      vector: titleEmbedding,
      topK: (topK + 1) * 10,
      includeMetadata: true,
    });

    console.log(`Found ${queryResults.matches.length} potential matches`);


    const billScores = new Map();

    for (const match of queryResults.matches) {
      const matchBillId = match.metadata.billId;


      if (matchBillId === billId.toString()) {
        continue;
      }

      if (!billScores.has(matchBillId)) {
        billScores.set(matchBillId, {
          billId: matchBillId,
          title: match.metadata.billTitle || match.metadata.title,
          scores: [],
          metadata: match.metadata,
        });
      }

      billScores.get(matchBillId).scores.push(match.score);
    }


    const similarBills = Array.from(billScores.values())
      .map(bill => ({
        billId: bill.billId,
        title: bill.title,
        similarityScore: bill.scores.reduce((a, b) => a + b, 0) / bill.scores.length,
        matchCount: bill.scores.length,
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, topK);

    console.log(`✅ Found ${similarBills.length} similar bills`);
    similarBills.forEach((bill, idx) => {
      console.log(`  ${idx + 1}. ${bill.title} (score: ${bill.similarityScore.toFixed(4)})`);
    });

    return similarBills;
  } catch (error) {
    console.error('Error finding similar bills:', error);
    throw error;
  }
};
