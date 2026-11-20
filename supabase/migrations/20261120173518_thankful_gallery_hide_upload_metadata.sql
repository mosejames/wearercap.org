alter policy "View published Thanksgiving videos" on storage.objects using (
  bucket_id = 'thankful-at-rca'
  and storage.allow_only_operation('storage.object.sign')
  and exists (select 1 from public.thankful_published_videos video where video.path = storage.objects.name)
);
