from django.conf.urls import include, url

from agora_spacewar.views import *

urlpatterns = [
    url(r'^$', main_view, name='main'),
]
