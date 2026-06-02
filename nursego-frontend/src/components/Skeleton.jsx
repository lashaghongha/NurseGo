import React from 'react';
import './Skeleton.css';

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style = {} }) {
  return (
    <div
      className="skeleton-pulse"
      style={{ width, height, borderRadius, ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Skeleton width={48} height={48} borderRadius="50%" />
        <div style={{ flex: 1 }}>
          <Skeleton height={16} style={{ marginBottom: 8 }} />
          <Skeleton width="60%" height={12} />
        </div>
      </div>
      <Skeleton height={12} style={{ marginBottom: 8 }} />
      <Skeleton height={12} width="80%" style={{ marginBottom: 8 }} />
      <Skeleton height={12} width="60%" />
    </div>
  );
}

export function SkeletonGrid({ count = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
