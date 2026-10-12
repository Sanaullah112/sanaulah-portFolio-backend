export const success = (res, data, message = 'Success', status = 200) => {
  return res.status(status).json({ success: true, message, data });
};

export const paginated = (res, { data, page, totalPages, totalCount }) => {
  return res.status(200).json({
    success: true,
    data,
    page,
    totalPages,
    totalCount,
  });
};
