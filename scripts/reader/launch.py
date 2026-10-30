# Starts the reader's training job on SageMaker: uploads the data (scripts/reader/gen.ts output) and
# this folder's train.py, and runs it on one GPU instance with a hard time limit. The bucket, role
# and data paths are arguments; nothing about the AWS account is kept in the repo.
#
#   python launch.py --bucket <bucket> --role <role arn> --data <dir with train.jsonl, valid.jsonl, *.menus.json>
#                    [--prefix beautifood-reader] [--instance ml.g5.xlarge] [--hours 3] [--epochs 3]
#   python launch.py --status <job name>     python launch.py --logs <job name>
import argparse, io, os, tarfile, time

import boto3

# AWS's PyTorch training image (PyTorch 2.10, Python 3.13, the Python the script is tested with);
# requirements.txt adds transformers. (The tag the SageMaker SDK gave for the Hugging Face image
# didn't exist: a tag is only trusted once a job has run on it.)
IMAGE = "763104351884.dkr.ecr.{region}.amazonaws.com/pytorch-training:2.10.0-gpu-py313-cu130-ubuntu22.04-sagemaker"
HERE = os.path.dirname(os.path.abspath(__file__))

def source_tar():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as t:
        for f in ("train.py", "requirements.txt"):
            t.add(os.path.join(HERE, f), arcname=f)
    return buf.getvalue()

def launch(a):
    region = boto3.session.Session().region_name or "us-east-1"
    s3 = boto3.client("s3")
    sm = boto3.client("sagemaker")
    job = f"beautifood-reader-{time.strftime('%Y%m%d-%H%M%S')}"
    base = f"{a.prefix}/{job}"
    for f in ("train.jsonl", "train.menus.json", "valid.jsonl", "valid.menus.json"):
        s3.upload_file(os.path.join(a.data, f), a.bucket, f"{base}/data/{f}")
    s3.put_object(Bucket=a.bucket, Key=f"{base}/source/sourcedir.tar.gz", Body=source_tar())
    sm.create_training_job(
        TrainingJobName=job,
        RoleArn=a.role,
        AlgorithmSpecification={"TrainingImage": IMAGE.format(region=region), "TrainingInputMode": "File"},
        HyperParameters={
            "sagemaker_program": "train.py",
            "sagemaker_submit_directory": f"s3://{a.bucket}/{base}/source/sourcedir.tar.gz",
            "epochs": str(a.epochs), "batch": str(a.batch), "lr": str(a.lr), "eval-every": "1000", "valid-limit": "0",
        },
        InputDataConfig=[{"ChannelName": "data", "DataSource": {"S3DataSource": {"S3DataType": "S3Prefix", "S3Uri": f"s3://{a.bucket}/{base}/data/", "S3DataDistributionType": "FullyReplicated"}}}],
        OutputDataConfig={"S3OutputPath": f"s3://{a.bucket}/{base}/output/"},
        ResourceConfig={"InstanceType": a.instance, "InstanceCount": 1, "VolumeSizeInGB": 50},
        StoppingCondition={"MaxRuntimeInSeconds": int(a.hours * 3600)},
        Tags=[{"Key": "project", "Value": "beautifood-reader"}],
    )
    print(job)

def logs(name, last=20):
    """The job's last log lines (CloudWatch): training steps, losses, valid scores."""
    cw = boto3.client("logs")
    streams = cw.describe_log_streams(logGroupName="/aws/sagemaker/TrainingJobs", logStreamNamePrefix=name)["logStreams"]
    for st in streams[:1]:
        ev = cw.get_log_events(logGroupName="/aws/sagemaker/TrainingJobs", logStreamName=st["logStreamName"], startFromHead=False, limit=last)["events"]
        for e in ev:
            print(e["message"][:300])

def status(name):
    d = boto3.client("sagemaker").describe_training_job(TrainingJobName=name)
    print(d["TrainingJobStatus"], d.get("SecondaryStatus"), d.get("FailureReason", ""), d.get("ModelArtifacts", {}).get("S3ModelArtifacts", ""))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--bucket"); p.add_argument("--role"); p.add_argument("--data")
    p.add_argument("--prefix", default="beautifood-reader")
    p.add_argument("--instance", default="ml.g5.xlarge")
    p.add_argument("--hours", type=float, default=3)
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--batch", type=int, default=32)
    p.add_argument("--lr", type=float, default=3e-5)
    p.add_argument("--status")
    p.add_argument("--logs")
    a = p.parse_args()
    logs(a.logs) if a.logs else status(a.status) if a.status else launch(a)
