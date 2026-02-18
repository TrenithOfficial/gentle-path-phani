package main

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"cloud.google.com/go/storage"
)

type UploadStore interface {
	// Save writes the file to storage at objectPath (example: "healing-sheets/<file>.pdf")
	Save(ctx context.Context, objectPath string, file multipart.File, contentType string) error

	// Open returns the file reader + contentType (best-effort)
	Open(ctx context.Context, objectPath string) (io.ReadCloser, string, error)

	// Delete removes the object (best-effort)
	Delete(ctx context.Context, objectPath string) error
}

func uploadsDriver() string {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("UPLOADS_DRIVER")))
	if v == "" {
		return "disk"
	}
	return v
}

func uploadsBucket() string {
	return strings.TrimSpace(os.Getenv("UPLOADS_BUCKET"))
}

// uploadsBaseDir returns a filesystem base directory where we can write uploads.
// - Cloud Run: /tmp/uploads (writable)
// - Local/dev: ./uploads
func uploadsBaseDir() string {
	if v := strings.TrimSpace(os.Getenv("UPLOADS_DIR")); v != "" {
		return v
	}
	if strings.TrimSpace(os.Getenv("K_SERVICE")) != "" {
		return filepath.Join(string(os.PathSeparator), "tmp", "uploads")
	}
	return filepath.Join(".", "uploads")
}

func newUploadStore() (UploadStore, error) {
	if uploadsDriver() == "gcs" {
		b := uploadsBucket()
		if b == "" {
			return nil, fmt.Errorf("UPLOADS_BUCKET is required when UPLOADS_DRIVER=gcs")
		}
		return &gcsStore{bucket: b}, nil
	}
	return &diskStore{baseDir: uploadsBaseDir()}, nil
}

/* -------------------- DISK STORE -------------------- */

type diskStore struct {
	baseDir string
}

func (d *diskStore) Save(ctx context.Context, objectPath string, file multipart.File, contentType string) error {
	_ = ctx

	dst := filepath.Join(d.baseDir, filepath.FromSlash(objectPath))
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, file)
	return err
}

func (d *diskStore) Open(ctx context.Context, objectPath string) (io.ReadCloser, string, error) {
	_ = ctx
	p := filepath.Join(d.baseDir, filepath.FromSlash(objectPath))
	f, err := os.Open(p)
	if err != nil {
		return nil, "", err
	}
	return f, "", nil
}

func (d *diskStore) Delete(ctx context.Context, objectPath string) error {
	_ = ctx
	p := filepath.Join(d.baseDir, filepath.FromSlash(objectPath))
	return os.Remove(p)
}

/* -------------------- GCS STORE -------------------- */

type gcsStore struct {
	bucket string
}

var (
	gcsOnce   sync.Once
	gcsClient *storage.Client
	gcsErr    error
)

func getGCSClient(ctx context.Context) (*storage.Client, error) {
	gcsOnce.Do(func() {
		gcsClient, gcsErr = storage.NewClient(ctx)
	})
	return gcsClient, gcsErr
}

func (g *gcsStore) Save(ctx context.Context, objectPath string, file multipart.File, contentType string) error {
	c, err := getGCSClient(ctx)
	if err != nil {
		return err
	}

	obj := c.Bucket(g.bucket).Object(objectPath)
	w := obj.NewWriter(ctx)

	if strings.TrimSpace(contentType) != "" {
		w.ContentType = contentType
	}

	if _, err := io.Copy(w, file); err != nil {
		_ = w.Close()
		return err
	}
	return w.Close()
}

func (g *gcsStore) Open(ctx context.Context, objectPath string) (io.ReadCloser, string, error) {
	c, err := getGCSClient(ctx)
	if err != nil {
		return nil, "", err
	}

	obj := c.Bucket(g.bucket).Object(objectPath)

	attrs, err := obj.Attrs(ctx)
	if err != nil {
		// still try to read, but return empty content-type if attrs fails
		r, rerr := obj.NewReader(ctx)
		if rerr != nil {
			return nil, "", rerr
		}
		return r, "", nil
	}

	r, err := obj.NewReader(ctx)
	if err != nil {
		return nil, "", err
	}
	return r, attrs.ContentType, nil
}

func (g *gcsStore) Delete(ctx context.Context, objectPath string) error {
	c, err := getGCSClient(ctx)
	if err != nil {
		return err
	}
	return c.Bucket(g.bucket).Object(objectPath).Delete(ctx)
}
