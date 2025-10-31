from django.urls import path

from . import views

urlpatterns = [
    path("review/initiate/", views.ReviewCycleInitiateView.as_view(), name="review-initiate"),
    path("review/form/", views.ReviewFormView.as_view(), name="review-form"),
    path("review/submit/", views.ReviewSubmitView.as_view(), name="review-submit"),
    path("review/analytics/", views.ReviewAnalyticsView.as_view(), name="review-analytics"),
    path("review/adaptation-index/", views.AdaptationIndexView.as_view(), name="review-adaptation-index"),
    path("task-goal/create/", views.TaskGoalCreateView.as_view(), name="task-goal-create"),
    path("task-review/start/", views.TaskReviewTriggerView.as_view(), name="task-review-start"),
    path("task-review/form/", views.TaskReviewFormView.as_view(), name="task-review-form"),
    path("task-review/submit/", views.TaskReviewSubmitView.as_view(), name="task-review-submit"),
]
