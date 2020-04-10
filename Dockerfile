FROM docker.pkg.github.com/wardcunningham/seran-wiki/seran-wiki:latest
RUN apk add graphviz

ADD . /seran-dig
CMD ["--port=80:8000", "../seran-dig/dig.ts"]
