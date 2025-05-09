-- Consolidated Database Setup Script for Online Voting System
-- This script combines all database initialization and update operations into a single file

-- 1. Create all required tables

-- Voter Table
CREATE TABLE IF NOT EXISTS voter (
    cnic VARCHAR(15) PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    public_key TEXT NOT NULL,
    has_voted BOOLEAN DEFAULT FALSE,
    reset_token TEXT,
    reset_expires TIMESTAMP
);

-- Admin Table
CREATE TABLE IF NOT EXISTS admin (
    cnic VARCHAR(15) PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    signing_private_key TEXT,
    signing_public_key TEXT
);

-- Election Table with all fields from various updates
CREATE TABLE IF NOT EXISTS election (
    election_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'completed')),
    encryption_public_key TEXT,
    encryption_private_key TEXT,
    uses_threshold_decryption BOOLEAN DEFAULT FALSE,
    threshold_value INTEGER,
    results JSONB,
    final_tally TEXT,
    count_completed_at TIMESTAMP,
    -- Added from election_history update
    candidate_history JSONB,
    count_method TEXT,
    total_votes INTEGER DEFAULT 0,
    -- Added from homomorphic_encryption update
    encrypted_tally TEXT,
    tally_last_updated TIMESTAMP,
    key_size INTEGER DEFAULT 2048
);

-- Candidate Table
CREATE TABLE IF NOT EXISTS candidate (
    candidate_id SERIAL PRIMARY KEY,
    election_id INT NOT NULL REFERENCES election(election_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    party TEXT NOT NULL,
    symbol TEXT NOT NULL
);

-- Blockchain Table (for storing votes)
CREATE TABLE IF NOT EXISTS blockchain (
    block_id SERIAL PRIMARY KEY,
    previous_hash TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data JSONB NOT NULL, -- Will contain encrypted vote information
    hash TEXT NOT NULL,
    nonce INTEGER,
    signature TEXT, -- For authority signature (Proof of Authority)
    validator_id TEXT -- ID of the authority node that validated this block
);

-- OTP Table (for email verification during voter registration)
CREATE TABLE IF NOT EXISTS otp (
    otp_id SERIAL PRIMARY KEY,
    cnic VARCHAR(15) NOT NULL,
    email VARCHAR(100) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    UNIQUE(cnic, email)
);

-- Create table for key shares used in threshold decryption
CREATE TABLE IF NOT EXISTS key_shares (
    share_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL REFERENCES election(election_id) ON DELETE CASCADE,
    share_index INTEGER NOT NULL,
    share_value TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(election_id, share_index)
);

-- Create table for partial decryptions from authorities
CREATE TABLE IF NOT EXISTS partial_decryptions (
    decryption_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL REFERENCES election(election_id) ON DELETE CASCADE,
    share_index INTEGER NOT NULL,
    partial_decryption TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(election_id, share_index)
);

-- Create voter_election junction table for per-election voting status
CREATE TABLE IF NOT EXISTS voter_election (
    voter_id VARCHAR(15) REFERENCES voter(cnic),
    election_id INT REFERENCES election(election_id) ON DELETE CASCADE,
    has_voted BOOLEAN DEFAULT FALSE,
    voted_at TIMESTAMP,
    PRIMARY KEY (voter_id, election_id)
);

-- 2. Create all necessary indexes

-- Add index for faster election status lookups
CREATE INDEX IF NOT EXISTS idx_election_status ON election(status);

-- Add indexes for faster lookups in voter_election table
CREATE INDEX IF NOT EXISTS idx_voter_election_voter_id ON voter_election(voter_id);
CREATE INDEX IF NOT EXISTS idx_voter_election_election_id ON voter_election(election_id);

-- 3. Insert initial data

-- Insert the admin user (password: Adminadmin@1) with signing keys
INSERT INTO admin (cnic, email, password_hash, signing_private_key, signing_public_key)
VALUES (
    '1234567890123', 
    'zainiqbal7007@gmail.com', 
    '$2b$10$V3SfJSFjtdBaEUcEEw.eUuKZsp5tSttdgwYu0PA1ELNEU6ju4jkyq',
    '-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAw8QftXFddKd6t/cIobRJVHvrgKt+MB9W27KTgkKTuW8JBzTH
xhgrU21m1BX4EYLQd1MpCmZ2Z8rxdo4+NN6s5a8M2u0vtY0KZadHTmojye4NUuz1
xEv1kKLOXnzO2XPIpPvfydmx+FVf5hTxRjOJYd7kvmB6muXOINEmbpWjoRF+8iNu
ZvDwr6HSggV9sirr7vpw27TBs5MpRUfGqIJN1lJJbEmVYAxT4LLIqg9MDpRqx9/T
P3wci7pcx3ORcDLF4iqDm+8X92g6eE5NOX2ZcxiALQn3gF+aVUB6y4Na2IUjEVpY
MVluPz6P6hKcxJUQqYcbVyBUMcI7UAaz0WHZNQIDAQABAoIBAAWJsIObjZ3SwrSz
YF3iAaS0wwnMhXZl3ePl9mjGqohMxQ1cYkivCdi4vUzYwz/25Uqe17LI3mbGFam5
e+EsfxPEmCvq7kDSmNLygLX4kthv62tnXctxV6TBX5j01bgj35mVMMnfETsEapZR
t4KOy38xL44tdgJtkkoY3d9edyFuVnCsHUyL30UYcW+7yQUcLRtjWsstisa9dXAp
VgMnujnnUWLnsc9lw+gKvwk+1hKysk1JoZLZ0WNU2GrKgStlI+gH9fotZkgUzS0Y
Fquzo1GcYDoNYduuiqXDpG2FbzBvXVJl7MfmH45o/agSwuBPgvGY7cCguG6orZ02
5fGoKckCgYEA+u9/FbdqFNeZvu/O8qcHH6OQnjMj/GSKYJkAiM7626XN3tJXdflF
Fx1KfJ465Nz1HLTyaP3j8KPix/QsbqoGUldVOx8czDCzO6Zt2XLfN+2UG0RvL8/G
rfB3UD8rN9McBhrEwsJRimZwpR6GUMP0GYlOPCdSo5Zz1vLmGl50YX0CgYEAx7eV
rcJLW4gqVyPOQNBPpRef+TnazXxi2VGZNMiF3Ol0UultF9Qb5lBEw33lFy4EkW12
qzGUdMtgK/EOx3eSSF3kmRlnsBBXaBQt1f7YmrlOm+w8wX15LPnJYZ85O+f6tmAD
cONknvjMnoFWkLyCpLJM3ncpxgDvDU3JXVzF5BkCgYEAhfw1HjJV+RT5qcK//D6F
Bja+tEnYMB666EMpzuK9fWR1nUEwo/RaGLJyIEIYbjUwx4gyWy8dc1L+dweAZgJw
56xr/Opq5Pgn63S8+LtmRqWbTEfpGl1V13ArNPTVrbQSJYxLfTZmdYCnKvM2go9u
mef/lwzkCib+aUo+5NuERr0CgYBWdreZe3WOkhvqj/jafJUOn3TFvHNq5QASn84Z
WPsDUhrnTmHJoC3X/0ZV8Go/J9AYefCXWyavjeD8BSfl2XF+XQ/77FDEm76Ls7jI
XcW+7p0Gyjbfegf9HcM+vWVU9zDGxjiXJgtI++Pyd4JXtRVGYl7/LU3riDn2Y4fb
ILAX+QKBgENipjS4gTGLGJuG44B/ixchCxUmeNeqdXbRMSZv1Bjk2kHtjMljGFA5
c8S9AFYJTVl6soeNbeUsgFhNYaqA1YJKm7xLXEA/UzayuSvRalUOJMwYt2BSaRN+
RjVSUToXJqFtDot8hctGRFOYd924YOWIKPYHDqcfsoyI6KH09N9k
-----END RSA PRIVATE KEY-----',
    '-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw8QftXFddKd6t/cIobRJ
VHvrgKt+MB9W27KTgkKTuW8JBzTHxhgrU21m1BX4EYLQd1MpCmZ2Z8rxdo4+NN6s
5a8M2u0vtY0KZadHTmojye4NUuz1xEv1kKLOXnzO2XPIpPvfydmx+FVf5hTxRjOJ
Yd7kvmB6muXOINEmbpWjoRF+8iNuZvDwr6HSggV9sirr7vpw27TBs5MpRUfGqIJN
1lJJbEmVYAxT4LLIqg9MDpRqx9/TP3wci7pcx3ORcDLF4iqDm+8X92g6eE5NOX2Z
cxiALQn3gF+aVUB6y4Na2IUjEVpYMVluPz6P6hKcxJUQqYcbVyBUMcI7UAaz0WHZ
NQIDAQAB
-----END PUBLIC KEY-----'
)
ON CONFLICT (cnic) DO UPDATE SET 
    password_hash = '$2b$10$V3SfJSFjtdBaEUcEEw.eUuKZsp5tSttdgwYu0PA1ELNEU6ju4jkyq',
    signing_private_key = '-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAw8QftXFddKd6t/cIobRJVHvrgKt+MB9W27KTgkKTuW8JBzTH
xhgrU21m1BX4EYLQd1MpCmZ2Z8rxdo4+NN6s5a8M2u0vtY0KZadHTmojye4NUuz1
xEv1kKLOXnzO2XPIpPvfydmx+FVf5hTxRjOJYd7kvmB6muXOINEmbpWjoRF+8iNu
ZvDwr6HSggV9sirr7vpw27TBs5MpRUfGqIJN1lJJbEmVYAxT4LLIqg9MDpRqx9/T
P3wci7pcx3ORcDLF4iqDm+8X92g6eE5NOX2ZcxiALQn3gF+aVUB6y4Na2IUjEVpY
MVluPz6P6hKcxJUQqYcbVyBUMcI7UAaz0WHZNQIDAQABAoIBAAWJsIObjZ3SwrSz
YF3iAaS0wwnMhXZl3ePl9mjGqohMxQ1cYkivCdi4vUzYwz/25Uqe17LI3mbGFam5
e+EsfxPEmCvq7kDSmNLygLX4kthv62tnXctxV6TBX5j01bgj35mVMMnfETsEapZR
t4KOy38xL44tdgJtkkoY3d9edyFuVnCsHUyL30UYcW+7yQUcLRtjWsstisa9dXAp
VgMnujnnUWLnsc9lw+gKvwk+1hKysk1JoZLZ0WNU2GrKgStlI+gH9fotZkgUzS0Y
Fquzo1GcYDoNYduuiqXDpG2FbzBvXVJl7MfmH45o/agSwuBPgvGY7cCguG6orZ02
5fGoKckCgYEA+u9/FbdqFNeZvu/O8qcHH6OQnjMj/GSKYJkAiM7626XN3tJXdflF
Fx1KfJ465Nz1HLTyaP3j8KPix/QsbqoGUldVOx8czDCzO6Zt2XLfN+2UG0RvL8/G
rfB3UD8rN9McBhrEwsJRimZwpR6GUMP0GYlOPCdSo5Zz1vLmGl50YX0CgYEAx7eV
rcJLW4gqVyPOQNBPpRef+TnazXxi2VGZNMiF3Ol0UultF9Qb5lBEw33lFy4EkW12
qzGUdMtgK/EOx3eSSF3kmRlnsBBXaBQt1f7YmrlOm+w8wX15LPnJYZ85O+f6tmAD
cONknvjMnoFWkLyCpLJM3ncpxgDvDU3JXVzF5BkCgYEAhfw1HjJV+RT5qcK//D6F
Bja+tEnYMB666EMpzuK9fWR1nUEwo/RaGLJyIEIYbjUwx4gyWy8dc1L+dweAZgJw
56xr/Opq5Pgn63S8+LtmRqWbTEfpGl1V13ArNPTVrbQSJYxLfTZmdYCnKvM2go9u
mef/lwzkCib+aUo+5NuERr0CgYBWdreZe3WOkhvqj/jafJUOn3TFvHNq5QASn84Z
WPsDUhrnTmHJoC3X/0ZV8Go/J9AYefCXWyavjeD8BSfl2XF+XQ/77FDEm76Ls7jI
XcW+7p0Gyjbfegf9HcM+vWVU9zDGxjiXJgtI++Pyd4JXtRVGYl7/LU3riDn2Y4fb
ILAX+QKBgENipjS4gTGLGJuG44B/ixchCxUmeNeqdXbRMSZv1Bjk2kHtjMljGFA5
c8S9AFYJTVl6soeNbeUsgFhNYaqA1YJKm7xLXEA/UzayuSvRalUOJMwYt2BSaRN+
RjVSUToXJqFtDot8hctGRFOYd924YOWIKPYHDqcfsoyI6KH09N9k
-----END RSA PRIVATE KEY-----',
    signing_public_key = '-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw8QftXFddKd6t/cIobRJ
VHvrgKt+MB9W27KTgkKTuW8JBzTHxhgrU21m1BX4EYLQd1MpCmZ2Z8rxdo4+NN6s
5a8M2u0vtY0KZadHTmojye4NUuz1xEv1kKLOXnzO2XPIpPvfydmx+FVf5hTxRjOJ
Yd7kvmB6muXOINEmbpWjoRF+8iNuZvDwr6HSggV9sirr7vpw27TBs5MpRUfGqIJN
1lJJbEmVYAxT4LLIqg9MDpRqx9/TP3wci7pcx3ORcDLF4iqDm+8X92g6eE5NOX2Z
cxiALQn3gF+aVUB6y4Na2IUjEVpYMVluPz6P6hKcxJUQqYcbVyBUMcI7UAaz0WHZ
NQIDAQAB
-----END PUBLIC KEY-----';
-- 4. Database migration for existing data (if applicable)

-- Migrate any existing voting data if available (this will only work for active voters)
INSERT INTO voter_election (voter_id, election_id, has_voted, voted_at)
SELECT v.cnic, e.election_id, v.has_voted, NOW() 
FROM voter v 
CROSS JOIN election e 
WHERE v.has_voted = true 
AND e.status = 'completed'
ON CONFLICT DO NOTHING;