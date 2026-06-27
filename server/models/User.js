const { query } = require("../db");

const mapUser = (row, includePassword = true) => {
  if (!row) return null;

  const user = {
    _id: String(row.id),
    id: String(row.id),
    name: row.name,
    email: row.email,
    googleId: row.google_id,
    avatar: row.avatar,
    isAdmin: row.is_admin,
    date: row.created_at,
  };

  if (includePassword) {
    user.password = row.password;
  }

  return user;
};

const findByEmail = async (email) => {
  const result = await query(
    "SELECT * FROM users WHERE email = LOWER($1) LIMIT 1",
    [email],
  );
  return mapUser(result.rows[0]);
};

const findById = async (id, { includePassword = false } = {}) => {
  const result = await query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  return mapUser(result.rows[0], includePassword);
};

const create = async ({ name, email, password }) => {
  const result = await query(
    `INSERT INTO users (name, email, password)
     VALUES ($1, LOWER($2), $3)
     RETURNING *`,
    [name, email, password],
  );
  return mapUser(result.rows[0]);
};

const findOrCreateGoogleUser = async ({ googleId, name, email, avatar }) => {
  const existing = await query(
    `SELECT *
       FROM users
      WHERE google_id = $1 OR email = LOWER($2)
      ORDER BY (google_id = $1) DESC
      LIMIT 1`,
    [googleId, email],
  );

  if (existing.rows[0]) {
    const updated = await query(
      `UPDATE users
          SET google_id = $1,
              name = $2,
              email = LOWER($3),
              avatar = $4
        WHERE id = $5
        RETURNING *`,
      [googleId, name, email, avatar, existing.rows[0].id],
    );
    return mapUser(updated.rows[0]);
  }

  const created = await query(
    `INSERT INTO users (google_id, name, email, avatar)
     VALUES ($1, $2, LOWER($3), $4)
     RETURNING *`,
    [googleId, name, email, avatar],
  );
  return mapUser(created.rows[0]);
};

module.exports = {
  create,
  findByEmail,
  findById,
  findOrCreateGoogleUser,
};
