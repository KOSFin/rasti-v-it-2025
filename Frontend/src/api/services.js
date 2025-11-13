import api from './axios';

const extractListPayload = (data) => {
  if (!data) {
    return [];
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data?.data?.results) ? data.data.results : data?.results || [];
};

const collectPaginatedResults = async (path, initialParams = {}) => {
  let url = path;
  let params = { ...initialParams };
  const aggregated = [];
  let lastResponseData = null;

  while (url) {
    const hasParams = params && Object.keys(params).length > 0;
    const response = await api.get(url, hasParams ? { params } : undefined);
    const payload = response?.data;
    lastResponseData = payload;
    aggregated.push(...extractListPayload(payload));

    const nextUrl = payload?.next;
    if (!nextUrl) {
      break;
    }

    url = nextUrl;
    params = undefined;
  }

  const count = typeof lastResponseData?.count === 'number' ? lastResponseData.count : aggregated.length;

  return {
    items: aggregated,
    count,
  };
};

const buildListFetcher = (path) => ({ url, params } = {}) => {
  if (url) {
    return api.get(url);
  }
  return api.get(path, params ? { params } : undefined);
};

export const login = (username, password) => 
  api.post('/api/auth/login/', { username, password });

export const register = (userData) => 
  api.post('/api/auth/register/', userData);

export const logout = (refreshToken) => 
  api.post('/api/auth/logout/', refreshToken ? { refresh: refreshToken } : {});

export const getCurrentUser = () => 
  api.get('/api/auth/me/');

export const adminCreateEmployee = (payload) =>
  api.post('/api/auth/admin/create-employee/', payload);

export const listOrganizations = buildListFetcher('/api/organizations/');

export const createOrganization = (data) =>
  api.post('/api/organizations/', data);

export const updateOrganization = (id, data) =>
  api.patch(`/api/organizations/${id}/`, data);

export const deleteOrganization = (id) =>
  api.delete(`/api/organizations/${id}/`);

export const getDepartments = (params) =>
  api.get('/api/departments/', params ? { params } : undefined);

export const listDepartments = buildListFetcher('/api/departments/');

export const getDepartment = (id) => 
  api.get(`/api/departments/${id}/`);

export const createDepartment = (data) =>
  api.post('/api/departments/', data);

export const updateDepartment = (id, data) =>
  api.patch(`/api/departments/${id}/`, data);

export const deleteDepartment = (id) =>
  api.delete(`/api/departments/${id}/`);

export const listTeams = buildListFetcher('/api/teams/');

export const createTeam = (data) =>
  api.post('/api/teams/', data);

export const updateTeam = (id, data) =>
  api.patch(`/api/teams/${id}/`, data);

export const deleteTeam = (id) =>
  api.delete(`/api/teams/${id}/`);

export const getEmployees = (params) =>
  api.get('/api/employees/', { params });

export const listEmployees = buildListFetcher('/api/employees/');

export const getAllEmployees = async (params) => {
  const { items } = await collectPaginatedResults('/api/employees/', params);
  return items;
};

export const getEmployee = (id) => 
  api.get(`/api/employees/${id}/`);

export const getManagers = () => 
  api.get('/api/employees/managers/');

export const updateEmployee = (id, data) =>
  api.patch(`/api/employees/${id}/`, data);

export const getTeam = (id) => 
  api.get(`/api/employees/${id}/team/`);

export const getColleagues = () =>
  api.get('/api/employees/colleagues/');

export const deleteEmployee = (id) =>
  api.delete(`/api/employees/${id}/`);

export const resetEmployeePassword = (id) =>
  api.post(`/api/employees/${id}/generate_password/`);

export const listRoleAssignments = buildListFetcher('/api/role-assignments/');

export const createRoleAssignment = (data) =>
  api.post('/api/role-assignments/', data);

export const updateRoleAssignment = (id, data) =>
  api.patch(`/api/role-assignments/${id}/`, data);

export const deleteRoleAssignment = (id) =>
  api.delete(`/api/role-assignments/${id}/`);

export const fetchByUrl = (url) => api.get(url);

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

export const completeGoal = (id, data) =>
  api.post(`/api/goals/${id}/complete/`, data);

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

export const getSelfAssessments = (params) => 
  api.get('/api/self-assessments/', { params });

export const getPendingSelfAssessments = () =>
  api.get('/api/self-assessments/pending/');

export const getSelfAssessment = (id) => 
  api.get(`/api/self-assessments/${id}/`);

export const createSelfAssessment = (data) => 
  api.post('/api/self-assessments/', data);

export const updateSelfAssessment = (id, data) => 
  api.put(`/api/self-assessments/${id}/`, data);

export const getFeedback360List = (params) => 
  api.get('/api/feedback-360/', { params });

export const getFeedback360ForMe = () => 
  api.get('/api/feedback-360/for_me/');

export const getPendingFeedback360 = () => 
  api.get('/api/feedback-360/pending/');

export const createFeedback360 = (data) => 
  api.post('/api/feedback-360/', data);

export const getManagerReviews = (params) => 
  api.get('/api/manager-reviews/', { params });

export const getMyTeam = () => 
  api.get('/api/manager-reviews/my_team/');

export const createManagerReview = (data) => 
  api.post('/api/manager-reviews/', data);

export const getPotentialAssessments = (params) => 
  api.get('/api/potential-assessments/', { params });

export const getNineBoxMatrix = () => 
  api.get('/api/potential-assessments/nine_box_matrix/');

export const createPotentialAssessment = (data) => 
  api.post('/api/potential-assessments/', data);

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

export const initiateReviewCycle = (payload) =>
  api.post('/api/performance/review/initiate/', payload);

export const getReviewFormByToken = (token) =>
  api.get('/api/performance/review/form/', { params: { token } });

export const submitReviewAnswers = (data) =>
  api.post('/api/performance/review/submit/', data);

export const getReviewAnalytics = (params) =>
  api.get('/api/performance/review/analytics/', { params });

export const getAdaptationIndex = (params) =>
  api.get('/api/performance/review/adaptation-index/', { params });

export const getSkillReviewOverview = (params) =>
  api.get('/api/performance/review/overview/', { params });

export const getSkillReviewManagerQueue = () =>
  api.get('/api/performance/review/manager/queue/');

export const submitSkillReviewFeedback = (data) =>
  api.post('/api/performance/review/manager/feedback/', data);

export const createReviewGoal = (data) =>
  api.post('/api/performance/task-goal/create/', data);

export const triggerTaskReview = (data) =>
  api.post('/api/performance/task-review/start/', data);

export const getTaskReviewForm = (token) =>
  api.get('/api/performance/task-review/form/', { params: { token } });

export const submitTaskReview = (data) =>
  api.post('/api/performance/task-review/submit/', data);

export const getNotifications = (params) =>
  api.get('/api/performance/notifications/', { params });

export const markNotificationRead = (id) =>
  api.post(`/api/performance/notifications/${id}/read/`);

export const markAllNotificationsRead = () =>
  api.post('/api/performance/notifications/mark-all/');

export const getGoalNotifications = (params) =>
  api.get('/api/goal-notifications/', { params });

export const getGoalNotificationsUnreadCount = () =>
  api.get('/api/goal-notifications/unread_count/');

export const markGoalNotificationRead = (id) =>
  api.post(`/api/goal-notifications/${id}/mark_read/`);
