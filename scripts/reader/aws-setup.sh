#!/usr/bin/env bash
# Sets up what the reader's training job needs on AWS (scripts/reader/launch.py), with the AWS CLI:
#   1. a private S3 bucket (public access blocked, encrypted at rest) for the data and the model;
#   2. a role SageMaker runs the job as, allowed only that bucket, its own logs and pulling the
#      Hugging Face training image;
#   3. (optional) for the IAM user that launches the job: upload and download on that bucket,
#      passing that role to SageMaker, and starting and reading training jobs.
# Run it as someone who can create buckets, roles and policies (an admin profile). It changes
# nothing else, and is safe to run again: what already exists is kept.
#
#   bash scripts/reader/aws-setup.sh [--region us-east-1] [--bucket NAME] [--launcher IAM_USER_NAME] [--profile PROFILE]
#
# It prints the bucket and the role ARN to pass to launch.py.
set -euo pipefail

REGION="us-east-1"
BUCKET=""
LAUNCHER=""
PROFILE_ARGS=()
ROLE="BeautifoodReaderSageMakerRole"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="$2"; shift 2 ;;
    --bucket) BUCKET="$2"; shift 2 ;;
    --launcher) LAUNCHER="$2"; shift 2 ;;
    --profile) PROFILE_ARGS=(--profile "$2"); shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
aws_() { aws "${PROFILE_ARGS[@]}" --region "$REGION" "$@"; }

ACCOUNT=$(aws_ sts get-caller-identity --query Account --output text)
BUCKET=${BUCKET:-beautifood-reader-training-$(openssl rand -hex 4)}
echo "account ${ACCOUNT:0:4}…, region $REGION, bucket $BUCKET"

# 1. the bucket
if aws_ s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "bucket exists: $BUCKET"
else
  if [[ "$REGION" == "us-east-1" ]]; then
    aws_ s3api create-bucket --bucket "$BUCKET" >/dev/null
  else
    aws_ s3api create-bucket --bucket "$BUCKET" --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
  echo "bucket created: $BUCKET"
fi
aws_ s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws_ s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws_ s3api put-bucket-tagging --bucket "$BUCKET" --tagging 'TagSet=[{Key=project,Value=beautifood-reader}]'

# 2. the role SageMaker runs the job as
TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"sagemaker.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
ROLE_POLICY=$(cat <<JSON
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket","s3:GetBucketLocation"],"Resource":["arn:aws:s3:::$BUCKET","arn:aws:s3:::$BUCKET/*"]},
 {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents","logs:DescribeLogStreams"],"Resource":"arn:aws:logs:$REGION:$ACCOUNT:log-group:/aws/sagemaker/*"},
 {"Effect":"Allow","Action":"ecr:GetAuthorizationToken","Resource":"*"},
 {"Effect":"Allow","Action":["ecr:BatchGetImage","ecr:GetDownloadUrlForLayer","ecr:BatchCheckLayerAvailability"],"Resource":"arn:aws:ecr:$REGION:763104351884:repository/*"},
 {"Effect":"Allow","Action":"cloudwatch:PutMetricData","Resource":"*","Condition":{"StringEquals":{"cloudwatch:namespace":"/aws/sagemaker/TrainingJobs"}}}
]}
JSON
)
if aws_ iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  echo "role exists: $ROLE"
else
  aws_ iam create-role --role-name "$ROLE" --assume-role-policy-document "$TRUST" \
    --description "SageMaker training for the Beautifood order reader (one bucket only)" \
    --tags Key=project,Value=beautifood-reader >/dev/null
  echo "role created: $ROLE"
fi
aws_ iam put-role-policy --role-name "$ROLE" --policy-name reader-training --policy-document "$ROLE_POLICY"
ROLE_ARN=$(aws_ iam get-role --role-name "$ROLE" --query Role.Arn --output text)

# 3. what the launching user may do (only if --launcher is given)
if [[ -n "$LAUNCHER" ]]; then
  USER_POLICY=$(cat <<JSON
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:ListBucket","s3:GetBucketLocation"],"Resource":["arn:aws:s3:::$BUCKET","arn:aws:s3:::$BUCKET/*"]},
 {"Effect":"Allow","Action":"iam:PassRole","Resource":"$ROLE_ARN","Condition":{"StringEquals":{"iam:PassedToService":"sagemaker.amazonaws.com"}}},
 {"Effect":"Allow","Action":["sagemaker:CreateTrainingJob","sagemaker:DescribeTrainingJob","sagemaker:StopTrainingJob","sagemaker:AddTags"],"Resource":"arn:aws:sagemaker:$REGION:$ACCOUNT:training-job/beautifood-reader-*"},
 {"Effect":"Allow","Action":["logs:GetLogEvents","logs:DescribeLogStreams","logs:FilterLogEvents"],"Resource":"arn:aws:logs:$REGION:$ACCOUNT:log-group:/aws/sagemaker/TrainingJobs:*"}
]}
JSON
)
  aws_ iam put-user-policy --user-name "$LAUNCHER" --policy-name beautifood-reader-launch --policy-document "$USER_POLICY"
  echo "launch permissions given to IAM user: $LAUNCHER"
fi

# (a new role takes a few seconds to be usable by SageMaker)
sleep 10
echo
echo "bucket:   $BUCKET"
echo "role arn: $ROLE_ARN"
echo
echo "next: python scripts/reader/launch.py --bucket $BUCKET --role $ROLE_ARN --data <dir with train.jsonl, valid.jsonl and their .menus.json>"
