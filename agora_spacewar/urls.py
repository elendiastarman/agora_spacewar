from django.conf.urls import include, url

from agora_spacewar.views import *

urlpatterns = [
    url(r'^$', main_view, name='main'),
    url(r'^api/',
        include([
            url(r'^data$', api_data_view, name='data'),
            #url(r'^create$', api_create_view, name='create'),
            #url(r'^update$', api_update_view, name='update'),
            #url(r'^read$', api_read_view, name='read'),
            url(r'^query$', api_query_view, name='query'),
        ])
    ),
]
