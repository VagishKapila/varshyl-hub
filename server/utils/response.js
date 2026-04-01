function success(res, data, msg = null, status = 200) {
  const response = { data };
  if (msg) response.message = msg;
  res.status(status).json(response);
}

function error(res, status = 500, msg = 'Internal server error') {
  res.status(status).json({ error: msg });
}

module.exports = { success, error };
