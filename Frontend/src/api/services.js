import api from './axios';

// Authentication
export const login = (username, password) => 
  api.post('/api/auth/login/', { username, password });

export const register = (userData) => 
  api.post('/api/auth/register/', userData);

export const logout = (refreshToken) => 
  api.post('/api/auth/logout/', { refresh: refreshToken });

export const getCurrentUser = () => 
  api.get('/api/auth/me/');

export const adminCreateEmployee = (payload) =>
  api.post('/api/auth/admin/create-employee/', payload);

// Departments
export const getDepartments = () => 
  api.get('/api/departments/');

export const getDepartment = (id) => 
  api.get(`/api/departments/${id}/`);

export const createDepartment = (data) =>
  api.post('/api/departments/', data);

export const updateDepartment = (id, data) =>
  api.put(`/api/departments/${id}/`, data);

export const deleteDepartment = (id) =>
  api.delete(`/api/departments/${id}/`);

// Employees
export const getEmployees = (params) => 
  api.get('/api/employees/', { params });

export const getEmployee = (id) => 
  api.get(`/api/employees/${id}/`);

export const getManagers = () => 
  api.get('/api/employees/managers/');

export const getTeam = (id) => 
  api.get(`/api/employees/${id}/team/`);

export const deleteEmployee = (id) =>
  api.delete(`/api/employees/${id}/`);

export const resetEmployeePassword = (id) =>
  api.post(`/api/employees/${id}/generate_password/`);

// Goals
export const getGoals = (params) => 
  api.get('/api/goals/', { params });

export const getGoal = (id) => 
  api.get(`/api/goals/${id}/`);

export const createGoal = (data) => 
  api.post('/api/goals/', data);

export const updateGoal = (id, data) => 
  api.put(`/api/goals/${id}/`, data);

export const deleteGoal = (id) => 
  api.delete(`/api/goals/${id}/`);

// Tasks
export const getTasks = (params) => 
  api.get('/api/tasks/', { params });

export const getTask = (id) => 
  api.get(`/api/tasks/${id}/`);

export const createTask = (data) => 
  api.post('/api/tasks/', data);

export const updateTask = (id, data) => 
  api.put(`/api/tasks/${id}/`, data);

export const deleteTask = (id) => 
  api.delete(`/api/tasks/${id}/`);

// Self Assessments
export const getSelfAssessments = (params) => 
  api.get('/api/self-assessments/', { params });

export const getSelfAssessment = (id) => 
  api.get(`/api/self-assessments/${id}/`);

export const createSelfAssessment = (data) => 
  api.post('/api/self-assessments/', data);

export const updateSelfAssessment = (id, data) => 
  api.put(`/api/self-assessments/${id}/`, data);

// Feedback 360
export const getFeedback360List = (params) => 
  api.get('/api/feedback-360/', { params });

export const getFeedback360ForMe = () => 
  api.get('/api/feedback-360/for_me/');

export const getPendingFeedback360 = () => 
  api.get('/api/feedback-360/pending/');

export const createFeedback360 = (data) => 
  api.post('/api/feedback-360/', data);

// Manager Reviews
export const getManagerReviews = (params) => 
  api.get('/api/manager-reviews/', { params });

export const getMyTeam = () => 
  api.get('/api/manager-reviews/my_team/');

export const createManagerReview = (data) => 
  api.post('/api/manager-reviews/', data);

// Potential Assessments
export const getPotentialAssessments = (params) => 
  api.get('/api/potential-assessments/', { params });

export const getNineBoxMatrix = () => 
  api.get('/api/potential-assessments/nine_box_matrix/');

export const createPotentialAssessment = (data) => 
  api.post('/api/potential-assessments/', data);

// Final Reviews
export const getFinalReviews = (params) => 
  api.get('/api/final-reviews/', { params });

export const getFinalReview = (id) => 
  api.get(`/api/final-reviews/${id}/`);

export const createFinalReview = (data) => 
  api.post('/api/final-reviews/', data);

export const calculateFinalScore = (id) => 
  api.post(`/api/final-reviews/${id}/calculate_final_score/`);

export const getFinalReviewStatistics = () => 
  api.get('/api/final-reviews/statistics/');
