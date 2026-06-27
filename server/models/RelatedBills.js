const { query } = require("../db");

const mapRow = (row) => {
  if (!row) return null;
  return {
    billId: row.bill_id,
    billTitle: row.bill_title,
    relatedBills: row.related_bills || [],
    lastUpdated: row.last_updated,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const findOne = async ({ billId }) => {
  const result = await query(
    "SELECT * FROM related_bills WHERE bill_id = $1 LIMIT 1",
    [String(billId)],
  );
  return mapRow(result.rows[0]);
};

const findOneAndUpdate = async ({ billId }, update) => {
  const result = await query(
    `INSERT INTO related_bills (
       bill_id, bill_title, related_bills, last_updated, updated_at
     )
     VALUES ($1, $2, $3::jsonb, $4, NOW())
     ON CONFLICT (bill_id)
     DO UPDATE SET
       bill_title = EXCLUDED.bill_title,
       related_bills = EXCLUDED.related_bills,
       last_updated = EXCLUDED.last_updated,
       updated_at = NOW()
     RETURNING *`,
    [
      String(billId),
      update.billTitle,
      JSON.stringify(update.relatedBills || []),
      update.lastUpdated || new Date(),
    ],
  );
  return mapRow(result.rows[0]);
};

module.exports = {
  findOne,
  findOneAndUpdate,
};
